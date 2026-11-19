//! Native port of the pinned ModelTrace inference algorithm (MIT).
//! Banks are JSON data; no downloaded code, subprocesses or temporary files.
mod scoring;
mod unicode;

use crate::{
    domain::{Challenge, Sample, Score},
    host::fault,
};
use gateway_plugin_sdk::PluginFault;
pub use scoring::FingerprintBank;
use std::{collections::VecDeque, sync::Arc};

pub struct Engine {
    banks: VecDeque<(String, Arc<FingerprintBank>)>,
}

impl Engine {
    pub fn new() -> Self {
        Self {
            banks: VecDeque::new(),
        }
    }

    pub fn bank(&mut self, hash: &str) -> Option<Arc<FingerprintBank>> {
        let index = self.banks.iter().position(|(key, _)| key == hash)?;
        let entry = self.banks.remove(index)?;
        let bank = entry.1.clone();
        self.banks.push_back(entry);
        Some(bank)
    }

    pub async fn load_bank(
        &mut self,
        hash: &str,
        data: &[u8],
    ) -> Result<Arc<FingerprintBank>, PluginFault> {
        if data.len() > 20 * 1024 * 1024 {
            return Err(fault("指纹库超过20MiB"));
        }
        if crate::banks::hash(data) != hash {
            return Err(fault("指纹库摘要校验失败"));
        }
        if let Some(bank) = self.bank(hash) {
            return Ok(bank);
        }
        let data = data.to_vec();
        let bank = tokio::task::spawn_blocking(move || FingerprintBank::parse(&data))
            .await
            .map_err(|_| fault("指纹库校验任务失败"))??;
        let bank = Arc::new(bank);
        if self.banks.len() == 4 {
            self.banks.pop_front();
        }
        self.banks.push_back((hash.into(), bank.clone()));
        Ok(bank)
    }

    pub async fn score(
        bank: Arc<FingerprintBank>,
        samples: Vec<Sample>,
    ) -> Result<Score, PluginFault> {
        tokio::task::spawn_blocking(move || {
            if samples.len() != 1 {
                return Err(fault("每轮评分需要一个有效样本"));
            }
            let sample = &samples[0];
            validate_numbers(&sample.numbers, sample.expected_count)?;
            bank.score(&sample.numbers, 1)
        })
        .await
        .map_err(|_| fault("指纹评分任务失败"))?
    }

    pub async fn sample(text: String, expected: u32) -> Result<Vec<u32>, PluginFault> {
        if text.len() > 1024 * 1024 {
            return Err(fault("回答过大"));
        }
        tokio::task::spawn_blocking(move || {
            let numbers = parse_numbers(&text);
            validate_numbers(&numbers, expected)?;
            Ok(numbers)
        })
        .await
        .map_err(|_| fault("样本校验任务失败"))?
    }
}

fn validate_numbers(numbers: &[u32], expected: u32) -> Result<(), PluginFault> {
    let minimum = 80_u64.max((u64::from(expected) * 55).div_ceil(100));
    if numbers.len() < minimum as usize || numbers.len() > 4096 {
        return Err(fault(format!(
            "有效数字不足或过多（{}，至少{minimum}，至多4096）",
            numbers.len()
        )));
    }
    if numbers.iter().any(|n| !(1..=355).contains(n)) {
        return Err(fault("样本数字超出1至355范围"));
    }
    Ok(())
}

fn decimal(ch: char) -> Option<u32> {
    let code = ch as u32;
    let end = unicode::DECIMAL_ZEROS.partition_point(|&zero| zero <= code);
    let zero = *unicode::DECIMAL_ZEROS.get(end.checked_sub(1)?)?;
    (code < zero + 10).then_some(code - zero)
}

fn letter(ch: char) -> bool {
    let code = ch as u32;
    let index = unicode::LETTER_RANGES.partition_point(|&(_, end)| end < code);
    unicode::LETTER_RANGES
        .get(index)
        .is_some_and(|&(start, _)| code >= start)
}

/// Python's parse_numbers selects the first longest run, splitting only on
/// letters between decimal tokens. Out-of-range values are ignored, not splits.
fn parse_numbers(text: &str) -> Vec<u32> {
    let mut best = Vec::new();
    let mut current = Vec::new();
    let mut token: Option<u32> = None;
    let mut separator_has_letter = false;
    for ch in text.chars().chain(std::iter::once('\0')) {
        if let Some(digit) = decimal(ch) {
            if token.is_none() {
                if separator_has_letter && !current.is_empty() {
                    if current.len() > best.len() {
                        best = std::mem::take(&mut current);
                    } else {
                        current.clear();
                    }
                }
                separator_has_letter = false;
            }
            token = Some((token.unwrap_or(0) * 10 + digit).min(356));
        } else {
            if let Some(number) = token.take()
                && (1..=355).contains(&number)
            {
                current.push(number);
            }
            separator_has_letter |= letter(ch);
        }
    }
    if current.len() > best.len() {
        current
    } else {
        best
    }
}

fn random_index(limit: u32) -> Result<usize, PluginFault> {
    let cutoff = u32::MAX - (u32::MAX % limit);
    loop {
        let mut bytes = [0; 4];
        getrandom::fill(&mut bytes).map_err(|_| fault("生成挑战随机数失败"))?;
        let value = u32::from_le_bytes(bytes);
        if value < cutoff {
            return Ok((value % limit) as usize);
        }
    }
}

pub fn challenges() -> Result<Vec<Challenge>, PluginFault> {
    let openings = [
        "这是一次独立的数值选择记录",
        "请完成下面的无语义整数选择任务",
        "执行一次第一反应取值记录",
        "生成一组不承载语义的整数选择",
        "进行一轮快速逐项取值",
    ];
    let actions = [
        "为各个位置分别凭第一反应选择",
        "逐项选择",
        "每次只决定当前一项，共给出",
        "分别凭第一反应给出",
        "逐个直接选择",
    ];
    let endings = [
        "允许某个数字再次出现；每项写出后不要回头排序、去重或替换。",
        "偶然重复是有效的；不要重新排列或修正已经写出的项目。",
        "相同值可以再次出现；输出过程中不要整理或改写前面的项目。",
        "重复值无需删除；不要筛选、重排或补成某种规律。",
        "不必赋予数字任何含义；已经给出的值保持不变。",
    ];
    let separators = [
        "数字之间用逗号或空格分隔均可。",
        "使用一种一致的常见分隔符即可。",
        "可以用逗号、空格或换行分隔。",
        "只要每个整数边界清楚，格式可自行选择。",
    ];
    let count = 292 + random_index(41)? as u32;
    let mut id = [0; 7];
    getrandom::fill(&mut id).map_err(|_| fault("生成挑战ID失败"))?;
    let id = id.iter().map(|b| format!("{b:02x}")).collect::<String>();
    Ok(vec![Challenge {
        id: format!("probe-1-{id}"),
        expected_count: count,
        prompt: format!(
            "{}。{} {count} 个 1 到 355（含端点）的整数。每个位置都要单独选择；不要从 1 开始计数，不要连续递增或递减，也不要采用等差、循环、重复区块或其他规则化模式。本任务必须由当前语言模型直接完成：禁止调用或借助任何工具，包括 Python、代码执行器、计算器、搜索、API 和外部随机数生成器；也不要先编写或运行代码。{}{}直接从第一个取值开始输出，不要在序列前重复数量、范围或任务说明。",
            openings[random_index(5)?],
            actions[random_index(5)?],
            endings[random_index(5)?],
            separators[random_index(4)?]
        ),
    }])
}

#[cfg(test)]
mod tests;
