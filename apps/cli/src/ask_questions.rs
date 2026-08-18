use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AskQuestionsOptionSpec {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AskQuestionsQuestionSpec {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub allow_multiple: bool,
    #[serde(default)]
    pub options: Vec<AskQuestionsOptionSpec>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AskQuestionsRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub questions: Vec<AskQuestionsQuestionSpec>,
}

impl AskQuestionsRequest {
    pub fn validate(&self) -> Result<()> {
        if self.questions.is_empty() {
            return Err(anyhow!("ask_questions requires at least one question"));
        }

        let mut seen_ids = HashSet::new();
        for question in &self.questions {
            let id = question.id.trim();
            if id.is_empty() {
                return Err(anyhow!("ask_questions question id cannot be empty"));
            }
            if !seen_ids.insert(id.to_string()) {
                return Err(anyhow!("ask_questions question id cannot be duplicated: {}", id));
            }
            if question.title.trim().is_empty() {
                return Err(anyhow!("ask_questions question title cannot be empty: {}", id));
            }

            let mut seen_option_ids = HashSet::new();
            for option in &question.options {
                let option_id = option.id.trim();
                if option_id.is_empty() {
                    return Err(anyhow!("ask_questions option id cannot be empty: {}", id));
                }
                if !seen_option_ids.insert(option_id.to_string()) {
                    return Err(anyhow!(
                        "ask_questions option id cannot be duplicated: {}/{}",
                        id,
                        option_id
                    ));
                }
                if option.label.trim().is_empty() {
                    return Err(anyhow!("ask_questions option label cannot be empty: {}", id));
                }
            }
        }

        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AskQuestionsStatus {
    Answered,
    Skipped,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AskQuestionsAnswer {
    pub question_id: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub selected_option_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_text: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AskQuestionsResult {
    pub status: AskQuestionsStatus,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub answers: Vec<AskQuestionsAnswer>,
}

impl AskQuestionsResult {
    pub fn skipped() -> Self {
        Self {
            status: AskQuestionsStatus::Skipped,
            answers: Vec::new(),
        }
    }
}
