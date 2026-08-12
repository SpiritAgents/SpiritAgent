//! Relative time via ICU4X `RelativeTimeFormatter` (`numeric: auto`).
//! Matches Desktop `Intl.RelativeTimeFormat`. Chinese output inserts a space after digits.

use fixed_decimal::Decimal;
use icu_experimental::relativetime::options::Numeric;
use icu_experimental::relativetime::{
    RelativeTimeFormatter, RelativeTimeFormatterOptions, RelativeTimeFormatterPreferences,
};
use icu_locale::{Locale, locale};

const TIME_UNITS: [(Unit, i64); 7] = [
    (Unit::Year, 60 * 60 * 24 * 365),
    (Unit::Month, 60 * 60 * 24 * 30),
    (Unit::Week, 60 * 60 * 24 * 7),
    (Unit::Day, 60 * 60 * 24),
    (Unit::Hour, 60 * 60),
    (Unit::Minute, 60),
    (Unit::Second, 1),
];

#[derive(Clone, Copy)]
enum Unit {
    Year,
    Month,
    Week,
    Day,
    Hour,
    Minute,
    Second,
}

fn js_round(value: f64) -> i64 {
    (value + 0.5).floor() as i64
}

fn parse_locale(locale: &str) -> Locale {
    locale.trim().parse().unwrap_or(locale!("en"))
}

fn is_zh_locale(locale: &Locale) -> bool {
    locale.id.language.as_str() == "zh"
}

fn add_zh_relative_time_spaces(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 4);
    let mut prev_digit = false;
    for ch in text.chars() {
        if prev_digit && ('\u{4e00}'..='\u{9fff}').contains(&ch) {
            out.push(' ');
        }
        out.push(ch);
        prev_digit = ch.is_ascii_digit();
    }
    out
}

fn try_new_formatter(
    unit: Unit,
    prefs: RelativeTimeFormatterPreferences,
    options: RelativeTimeFormatterOptions,
) -> Option<RelativeTimeFormatter> {
    let result = match unit {
        Unit::Year => RelativeTimeFormatter::try_new_long_year(prefs, options),
        Unit::Month => RelativeTimeFormatter::try_new_long_month(prefs, options),
        Unit::Week => RelativeTimeFormatter::try_new_long_week(prefs, options),
        Unit::Day => RelativeTimeFormatter::try_new_long_day(prefs, options),
        Unit::Hour => RelativeTimeFormatter::try_new_long_hour(prefs, options),
        Unit::Minute => RelativeTimeFormatter::try_new_long_minute(prefs, options),
        Unit::Second => RelativeTimeFormatter::try_new_long_second(prefs, options),
    };
    result.ok()
}

fn new_formatter(
    unit: Unit,
    prefs: RelativeTimeFormatterPreferences,
    options: RelativeTimeFormatterOptions,
) -> RelativeTimeFormatter {
    try_new_formatter(unit, prefs, options).unwrap_or_else(|| {
        try_new_formatter(unit, locale!("en").into(), options)
            .expect("ICU compiled data includes English relative time")
    })
}

/// Locale-scoped ICU formatters, reused across a picker render.
pub struct RelativeTimeEngine {
    add_zh_spaces: bool,
    year: RelativeTimeFormatter,
    month: RelativeTimeFormatter,
    week: RelativeTimeFormatter,
    day: RelativeTimeFormatter,
    hour: RelativeTimeFormatter,
    minute: RelativeTimeFormatter,
    second: RelativeTimeFormatter,
}

impl RelativeTimeEngine {
    pub fn new(locale: &str) -> Self {
        let parsed = parse_locale(locale);
        let prefs = RelativeTimeFormatterPreferences::from(&parsed);
        let mut options = RelativeTimeFormatterOptions::default();
        options.numeric = Numeric::Auto;
        Self {
            add_zh_spaces: is_zh_locale(&parsed),
            year: new_formatter(Unit::Year, prefs, options),
            month: new_formatter(Unit::Month, prefs, options),
            week: new_formatter(Unit::Week, prefs, options),
            day: new_formatter(Unit::Day, prefs, options),
            hour: new_formatter(Unit::Hour, prefs, options),
            minute: new_formatter(Unit::Minute, prefs, options),
            second: new_formatter(Unit::Second, prefs, options),
        }
    }

    pub fn format(&self, unix_ms: u128, now_ms: u128) -> String {
        let delta_seconds = js_round((unix_ms as f64 - now_ms as f64) / 1000.0);
        for (unit, seconds) in TIME_UNITS {
            if delta_seconds.unsigned_abs() >= seconds as u64 || matches!(unit, Unit::Second) {
                let value = js_round(delta_seconds as f64 / seconds as f64);
                return self.format_value(unit, value);
            }
        }
        unix_ms.to_string()
    }

    fn format_value(&self, unit: Unit, value: i64) -> String {
        let formatter = match unit {
            Unit::Year => &self.year,
            Unit::Month => &self.month,
            Unit::Week => &self.week,
            Unit::Day => &self.day,
            Unit::Hour => &self.hour,
            Unit::Minute => &self.minute,
            Unit::Second => &self.second,
        };
        let text = formatter.format(Decimal::from(value)).to_string();
        if self.add_zh_spaces {
            add_zh_relative_time_spaces(&text)
        } else {
            text
        }
    }
}

pub fn format_relative_time(unix_ms: u128, now_ms: u128, locale: &str) -> String {
    RelativeTimeEngine::new(locale).format(unix_ms, now_ms)
}

#[cfg(test)]
mod tests {
    use super::format_relative_time;

    const NOW: u128 = 1_751_112_000_000; // 2026-06-28T12:00:00.000Z

    fn ago_ms(seconds: i64) -> u128 {
        (NOW as i128 - seconds as i128 * 1000) as u128
    }

    #[test]
    fn zh_inserts_spaces_between_digits_and_units() {
        assert_eq!(
            format_relative_time(ago_ms(3 * 60), NOW, "zh-CN"),
            "3 分钟前"
        );
        assert_eq!(
            format_relative_time(ago_ms(3 * 60), NOW, "zh-Hans"),
            "3 分钟前"
        );
    }

    #[test]
    fn zh_keeps_auto_labels_without_numeric_units() {
        assert_eq!(
            format_relative_time(ago_ms(24 * 60 * 60), NOW, "zh-CN"),
            "昨天"
        );
        assert_eq!(format_relative_time(NOW, NOW, "zh-CN"), "现在");
    }

    #[test]
    fn en_uses_intl_auto_labels() {
        assert_eq!(
            format_relative_time(ago_ms(3 * 60), NOW, "en"),
            "3 minutes ago"
        );
        assert_eq!(
            format_relative_time(ago_ms(24 * 60 * 60), NOW, "en"),
            "yesterday"
        );
        assert_eq!(format_relative_time(NOW, NOW, "en"), "now");
    }

    #[test]
    fn follows_ui_locale_instead_of_english_fallback() {
        assert_eq!(format_relative_time(ago_ms(3 * 60), NOW, "ja"), "3 分前");
        assert_eq!(
            format_relative_time(ago_ms(24 * 60 * 60), NOW, "ja"),
            "昨日"
        );
        assert_eq!(
            format_relative_time(ago_ms(3 * 60), NOW, "de"),
            "vor 3 Minuten"
        );
        assert_eq!(
            format_relative_time(ago_ms(24 * 60 * 60), NOW, "de"),
            "gestern"
        );
    }
}
