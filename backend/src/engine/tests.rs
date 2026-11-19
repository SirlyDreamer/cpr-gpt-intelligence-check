use super::*;
use crate::banks;
use serde_json::{Value, json};

#[test]
fn matches_python_reference_probabilities_and_parser() {
    let fixtures: Value =
        serde_json::from_str(include_str!("../../tests/fixtures/scoring.json")).unwrap();
    assert_eq!(fixtures["source"]["commit"], banks::engine_commit());
    let bank = FingerprintBank::parse(banks::BUILTIN).unwrap();
    let mut worst = 0.0_f64;
    for (index, case) in fixtures["scores"].as_array().unwrap().iter().enumerate() {
        let numbers: Vec<u32> = serde_json::from_value(case["numbers"].clone()).unwrap();
        let score = bank.score(&numbers, 1).unwrap();
        assert_eq!(score.prediction, case["prediction"], "case {index}");
        for (actual, expected) in score
            .results
            .iter()
            .zip(case["results"].as_array().unwrap())
        {
            assert_eq!(actual.model, expected["model"], "case {index}");
            let error = (actual.probability - expected["probability"].as_f64().unwrap()).abs();
            worst = worst.max(error);
            assert!(
                error <= 1e-10,
                "case {index}: {} error {error}",
                actual.model
            );
        }
        for (actual, expected) in score
            .families
            .as_array()
            .unwrap()
            .iter()
            .zip(case["families"].as_array().unwrap())
        {
            assert_eq!(actual["family"], expected["family"]);
            assert_eq!(actual["display_name"], expected["display_name"]);
            assert!(
                (actual["probability"].as_f64().unwrap()
                    - expected["probability"].as_f64().unwrap())
                .abs()
                    <= 1e-10
            );
        }
    }
    eprintln!(
        "ModelTrace reference: {} cases, maximum probability error {worst:e}",
        fixtures["scores"].as_array().unwrap().len()
    );
    for case in fixtures["parsing"].as_array().unwrap() {
        assert_eq!(
            json!(parse_numbers(case["text"].as_str().unwrap())),
            case["numbers"],
            "{}",
            case["text"]
        );
    }
}

#[test]
fn rejects_incompatible_or_invalid_banks() {
    let original: Value = serde_json::from_slice(banks::BUILTIN).unwrap();
    for (pointer, value) in [
        ("/schema", json!("unknown")),
        ("/method/range", json!([1, 999])),
        ("/models/1/id", original["models"][0]["id"].clone()),
        ("/models/0/counts", json!([1])),
        ("/models/0/counts/0", json!(-1)),
        ("/robust/model_order/0", json!("wrong")),
        ("/robust/hellinger/centroids", json!([])),
        ("/robust/hellinger/feature_scale/0", json!(0)),
        ("/robust/hellinger/feature_mean/0", json!(null)),
        ("/robust/hellinger/nuisance_basis", json!([[0]])),
        ("/robust/ordered_blocks/environment_centroids", json!([])),
        ("/robust/ordered_blocks/weight", json!(0.5)),
        ("/calibration/1/beta", json!(0)),
        ("/calibration/2/beta", json!(10001)),
        ("/calibration/3/cv_accuracy", json!(1.1)),
    ] {
        let mut changed = original.clone();
        *changed.pointer_mut(pointer).unwrap() = value;
        assert!(
            FingerprintBank::parse(&serde_json::to_vec(&changed).unwrap()).is_err(),
            "{pointer}"
        );
    }
    assert!(FingerprintBank::parse(b"{\"schema\":NaN}").is_err());
}

#[tokio::test]
async fn cache_tracks_bank_hash_and_bounds_memory() {
    let mut engine = Engine::new();
    let original: Value = serde_json::from_slice(banks::BUILTIN).unwrap();
    let first = engine
        .load_bank(&banks::hash(banks::BUILTIN), banks::BUILTIN)
        .await
        .unwrap();
    let again = engine
        .load_bank(&banks::hash(banks::BUILTIN), banks::BUILTIN)
        .await
        .unwrap();
    assert!(Arc::ptr_eq(&first, &again));
    assert!(
        engine
            .load_bank(&"0".repeat(64), banks::BUILTIN)
            .await
            .is_err()
    );
    for index in 0..5 {
        let mut changed = original.clone();
        changed["built_at"] = json!(index.to_string());
        let bytes = serde_json::to_vec(&changed).unwrap();
        let bank = engine
            .load_bank(&banks::hash(&bytes), &bytes)
            .await
            .unwrap();
        assert_eq!(bank.built_at, index.to_string());
    }
    assert_eq!(engine.banks.len(), 4);
    assert!(engine.bank(&banks::hash(banks::BUILTIN)).is_none());
    // An in-flight snapshot stays valid after eviction.
    assert!(first.score(&vec![1; 310], 1).is_ok());
}

#[tokio::test]
async fn samples_and_challenges_preserve_contract() {
    for count in [170, 171, 4096, 4097] {
        let text = vec!["1"; count].join(",");
        assert_eq!(
            Engine::sample(text, 310).await.is_ok(),
            (171..=4096).contains(&count)
        );
    }
    assert!(
        Engine::sample("x".repeat(1024 * 1024 + 1), 310)
            .await
            .is_err()
    );
    assert!(validate_numbers(&vec![0; 310], 310).is_err());
    let bank = Arc::new(FingerprintBank::parse(banks::BUILTIN).unwrap());
    assert!(Engine::score(bank.clone(), vec![]).await.is_err());
    assert!(
        Engine::score(
            bank,
            vec![Sample {
                numbers: vec![356; 310],
                expected_count: 310
            }]
        )
        .await
        .is_err()
    );
    let mut ids = std::collections::BTreeSet::new();
    for _ in 0..100 {
        let challenge = challenges().unwrap().remove(0);
        assert!((292..=332).contains(&challenge.expected_count));
        assert!(
            challenge
                .prompt
                .contains(&format!(" {} 个 1 到 355", challenge.expected_count))
        );
        assert!(ids.insert(challenge.id));
    }
}
