//! Port of vendor/modeltrace/fingerprint.py's nuisance-Hellinger + ordered blocks.
use crate::{
    banks,
    domain::{Candidate, Score},
    host::fault,
};
use gateway_plugin_sdk::PluginFault;
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Deserialize)]
struct Model {
    id: String,
    display_name: String,
    family: String,
    #[serde(default)]
    family_name: Option<String>,
    counts: Vec<f64>,
}

#[derive(Deserialize)]
struct Features {
    feature_mean: Vec<f64>,
    feature_scale: Vec<f64>,
    centroids: Vec<Vec<f64>>,
    nuisance_basis: Vec<Vec<f64>>,
    #[serde(default)]
    environment_centroids: Vec<Vec<Vec<f64>>>,
    #[serde(default)]
    weight: f64,
}

#[derive(Deserialize)]
struct Robust {
    model_order: Vec<String>,
    hellinger: Features,
    ordered_blocks: Features,
}
#[derive(Deserialize)]
struct Calibration {
    beta: f64,
    cv_accuracy: f64,
}
#[derive(Deserialize)]
pub struct FingerprintBank {
    schema: String,
    method: Value,
    #[serde(default)]
    pub built_at: String,
    models: Vec<Model>,
    robust: Robust,
    calibration: BTreeMap<String, Calibration>,
}

fn check(ok: bool, message: &str) -> Result<(), PluginFault> {
    if ok { Ok(()) } else { Err(fault(message)) }
}
fn vector(values: &[f64], dimension: usize) -> bool {
    values.len() == dimension && values.iter().all(|x| x.is_finite())
}
fn matrix(values: &[Vec<f64>], rows: usize, cols: usize) -> bool {
    values.len() == rows && values.iter().all(|row| vector(row, cols))
}

impl FingerprintBank {
    pub fn parse(data: &[u8]) -> Result<Self, PluginFault> {
        let bank: Self =
            serde_json::from_slice(data).map_err(|_| fault("指纹库JSON格式或数值无效"))?;
        static CONTRACT: std::sync::OnceLock<Value> = std::sync::OnceLock::new();
        let builtin =
            CONTRACT.get_or_init(|| serde_json::from_slice(banks::BUILTIN).expect("builtin bank"));
        check(
            bank.schema == builtin["schema"],
            "指纹库 schema 不兼容，请升级插件",
        )?;
        check(
            builtin["method"]
                .as_object()
                .unwrap()
                .iter()
                .all(|(key, value)| bank.method.get(key) == Some(value)),
            "指纹方法已变化，请升级插件",
        )?;
        let count = bank.models.len();
        check((2..=128).contains(&count), "指纹库须包含2至128个模型")?;
        let mut ids = BTreeSet::new();
        for model in &bank.models {
            check(
                (1..=128).contains(&model.id.chars().count()) && ids.insert(&model.id),
                "指纹库模型ID无效或重复",
            )?;
            check(
                model.display_name.chars().count() <= 128 && model.family.chars().count() <= 64,
                "模型名称或家族无效",
            )?;
            check(
                vector(&model.counts, 355)
                    && model.counts.iter().all(|&x| x >= 0.0)
                    && model.counts.iter().sum::<f64>() > 0.0,
                "指纹计数无效",
            )?;
        }
        check(
            bank.robust
                .model_order
                .iter()
                .eq(bank.models.iter().map(|m| &m.id)),
            "指纹模型顺序不一致",
        )?;
        for (features, dimension) in [
            (&bank.robust.hellinger, 355),
            (&bank.robust.ordered_blocks, 74),
        ] {
            check(
                vector(&features.feature_mean, dimension)
                    && vector(&features.feature_scale, dimension)
                    && features.feature_scale.iter().all(|&x| x > 0.0),
                "指纹标准化维度或尺度无效",
            )?;
            check(
                matrix(&features.centroids, count, dimension),
                "指纹中心矩阵无效",
            )?;
            check(
                features.nuisance_basis.len() <= dimension
                    && features
                        .nuisance_basis
                        .iter()
                        .all(|row| vector(row, dimension)),
                "指纹干扰基矩阵无效",
            )?;
        }
        let ordered = &bank.robust.ordered_blocks;
        check(
            (1..=64).contains(&ordered.environment_centroids.len())
                && ordered
                    .environment_centroids
                    .iter()
                    .all(|rows| matrix(rows, count, 74)),
            "指纹环境矩阵无效",
        )?;
        check(
            Some(ordered.weight) == builtin["robust"]["ordered_blocks"]["weight"].as_f64(),
            "指纹融合权重已变化，请升级插件",
        )?;
        for n in ["1", "2", "3"] {
            let c = bank
                .calibration
                .get(n)
                .ok_or_else(|| fault("指纹校准参数缺失"))?;
            check(
                c.beta.is_finite()
                    && c.beta > 0.0
                    && c.beta <= 10000.0
                    && c.cv_accuracy.is_finite()
                    && (0.0..=1.0).contains(&c.cv_accuracy),
                "指纹校准参数无效",
            )?;
        }
        let numbers: Vec<_> = (0..310).map(|i| (i * 97 + i * i) % 355 + 1).collect();
        for n in 1..=3 {
            bank.score(&numbers, n)?;
        }
        Ok(bank)
    }

    pub fn models(&self) -> Vec<banks::Model> {
        self.models
            .iter()
            .map(|m| banks::Model {
                id: m.id.clone(),
                label: m.display_name.clone(),
                family: m.family.clone(),
            })
            .collect()
    }

    pub(super) fn score(&self, numbers: &[u32], calibration: usize) -> Result<Score, PluginFault> {
        let mut counts = vec![0.5; 355];
        for &n in numbers {
            counts[n as usize - 1] += 1.0;
        }
        let hellinger = sqrt_distribution(counts);
        let marginal = nuisance_scores(&hellinger, &self.robust.hellinger);
        // Keep upstream's second standardization, including its rounding order.
        let marginal = standardize(marginal);
        let ordered = &self.robust.ordered_blocks;
        let feature = ordered_feature(numbers);
        let standardized = scale_feature(&feature, ordered);
        let normalized = normalize(standardized);
        let mut template = vec![f64::NEG_INFINITY; self.models.len()];
        for environment in &ordered.environment_centroids {
            for (i, centroid) in environment.iter().enumerate() {
                template[i] = template[i].max(dot(&normalized, centroid));
            }
        }
        let template = standardize(template);
        let nuisance = nuisance_scores(&feature, ordered);
        let ordered_scores = standardize(
            template
                .iter()
                .zip(nuisance)
                .map(|(a, b)| 0.5 * a + 0.5 * b)
                .collect(),
        );
        let beta = self.calibration[&calibration.to_string()].beta;
        let logits: Vec<_> = marginal
            .iter()
            .zip(ordered_scores)
            .map(|(a, b)| beta * ((1.0 - ordered.weight) * a + ordered.weight * b))
            .collect();
        check(
            logits.iter().all(|x| x.is_finite()),
            "指纹库离线评分自检失败",
        )?;
        let max = logits.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        let weights: Vec<_> = logits.iter().map(|x| (x - max).exp()).collect();
        let total: f64 = weights.iter().sum();
        let mut results: Vec<_> = weights
            .iter()
            .zip(&self.models)
            .map(|(weight, model)| Candidate {
                model: model.id.clone(),
                label: model.display_name.clone(),
                family: if model.family.is_empty() {
                    "models".into()
                } else {
                    model.family.clone()
                },
                probability: weight / total,
            })
            .collect();
        check(
            results
                .iter()
                .all(|r| r.probability.is_finite() && (0.0..=1.0).contains(&r.probability))
                && (results.iter().map(|r| r.probability).sum::<f64>() - 1.0).abs() <= 1e-8,
            "指纹库离线评分自检失败",
        )?;
        // Stable sorting preserves model order when probabilities tie.
        results.sort_by(|a, b| b.probability.total_cmp(&a.probability));
        let mut families = Vec::new();
        let mut seen = BTreeSet::new();
        for model in &self.models {
            let family = if model.family.is_empty() {
                "models"
            } else {
                &model.family
            };
            if !seen.insert(family) {
                continue;
            }
            let name = self
                .models
                .iter()
                .filter(|m| {
                    (if m.family.is_empty() {
                        "models"
                    } else {
                        &m.family
                    }) == family
                })
                .find_map(|m| m.family_name.as_deref().filter(|s| !s.is_empty()))
                .unwrap_or(match family {
                    "gpt" => "GPT",
                    "claude" => "Claude",
                    _ => family,
                });
            let probability: f64 = results
                .iter()
                .filter(|r| r.family == family)
                .map(|r| r.probability)
                .sum();
            families.push(json!({"family":family,"display_name":name,"probability":probability}));
        }
        Ok(Score {
            prediction: results[0].model.clone(),
            probability: results[0].probability,
            results,
            families: json!(families),
        })
    }
}

fn dot(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}
fn normalize(values: Vec<f64>) -> Vec<f64> {
    let norm = dot(&values, &values).sqrt().max(1e-12);
    values.iter().map(|v| v / norm).collect()
}
fn standardize(values: Vec<f64>) -> Vec<f64> {
    let mean = values.iter().sum::<f64>() / values.len() as f64;
    let scale = (values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / values.len() as f64)
        .sqrt()
        .max(1e-12);
    values.iter().map(|v| (v - mean) / scale).collect()
}
fn sqrt_distribution(values: Vec<f64>) -> Vec<f64> {
    let total: f64 = values.iter().sum();
    values.iter().map(|v| (v / total).sqrt()).collect()
}
fn scale_feature(values: &[f64], artifact: &Features) -> Vec<f64> {
    values
        .iter()
        .zip(&artifact.feature_mean)
        .zip(&artifact.feature_scale)
        .map(|((v, m), s)| (v - m) / s)
        .collect()
}
fn nuisance_scores(feature: &[f64], artifact: &Features) -> Vec<f64> {
    let mut projected = scale_feature(feature, artifact);
    // Compute every coefficient before subtracting the combined projection.
    let coefficients: Vec<_> = artifact
        .nuisance_basis
        .iter()
        .map(|row| dot(&projected, row))
        .collect();
    for (column, value) in projected.iter_mut().enumerate() {
        *value -= coefficients
            .iter()
            .zip(&artifact.nuisance_basis)
            .map(|(coefficient, row)| coefficient * row[column])
            .sum::<f64>();
    }
    let projected = normalize(projected);
    standardize(
        artifact
            .centroids
            .iter()
            .map(|row| dot(&projected, row))
            .collect(),
    )
}
fn ordered_feature(numbers: &[u32]) -> Vec<f64> {
    let mut result = Vec::with_capacity(74);
    let mut start = 0;
    for index in 0..4 {
        // NumPy array_split gives the first n % 4 chunks one extra element.
        let end = start + numbers.len() / 4 + usize::from(index < numbers.len() % 4);
        let mut bins = vec![0.5; 16];
        for &n in &numbers[start..end] {
            bins[((n - 1) * 16 / 355) as usize] += 1.0;
        }
        result.extend(sqrt_distribution(bins));
        start = end;
    }
    let mut digits = vec![0.5; 10];
    for &n in numbers {
        digits[(n % 10) as usize] += 1.0;
    }
    result.extend(sqrt_distribution(digits));
    result
}
