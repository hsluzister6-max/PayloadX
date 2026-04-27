use super::models::*;
use serde_json::Value;

pub struct ResponseValidator;

impl ResponseValidator {
    pub fn validate(
        validations: &[Validation],
        response: &ResponseDetails,
    ) -> Vec<ValidationResult> {
        validations.iter()
            .map(|v| Self::validate_single(v, response))
            .collect()
    }

    fn validate_single(validation: &Validation, response: &ResponseDetails) -> ValidationResult {
        match validation.validation_type {
            ValidationType::Status => Self::validate_status(validation, response),
            ValidationType::Body => Self::validate_body(validation, response),
            ValidationType::Header => Self::validate_header(validation, response),
            _ => ValidationResult {
                validation_type: format!("{:?}", validation.validation_type),
                passed: false,
                expected: validation.expected.clone(),
                actual: Value::Null,
                message: Some("Validation type not implemented".to_string()),
            },
        }
    }

    fn validate_status(validation: &Validation, response: &ResponseDetails) -> ValidationResult {
        let actual = Value::Number(response.status.into());
        let passed = Self::compare_values(&actual, &validation.expected, &validation.operator);

        ValidationResult {
            validation_type: "status".to_string(),
            passed,
            expected: validation.expected.clone(),
            actual,
            message: if !passed {
                validation.error_message.clone()
                    .or_else(|| Some(format!("Expected status {}, got {}", validation.expected, response.status)))
            } else {
                None
            },
        }
    }

    fn validate_body(validation: &Validation, response: &ResponseDetails) -> ValidationResult {
        let actual = if let Some(ref field) = validation.field {
            // Extract field from body
            Self::extract_field(&response.body, field).unwrap_or(Value::Null)
        } else {
            response.body.clone()
        };

        let passed = Self::compare_values(&actual, &validation.expected, &validation.operator);

        ValidationResult {
            validation_type: "body".to_string(),
            passed,
            expected: validation.expected.clone(),
            actual,
            message: if !passed {
                validation.error_message.clone()
            } else {
                None
            },
        }
    }

    fn validate_header(validation: &Validation, response: &ResponseDetails) -> ValidationResult {
        let header_name = validation.field.as_ref().unwrap();
        let actual = response.headers.get(header_name)
            .map(|v| Value::String(v.clone()))
            .unwrap_or(Value::Null);

        let passed = Self::compare_values(&actual, &validation.expected, &validation.operator);

        ValidationResult {
            validation_type: "header".to_string(),
            passed,
            expected: validation.expected.clone(),
            actual,
            message: if !passed {
                validation.error_message.clone()
            } else {
                None
            },
        }
    }

    fn compare_values(actual: &Value, expected: &Value, operator: &ValidationOperator) -> bool {
        match operator {
            ValidationOperator::Equals => actual == expected,
            ValidationOperator::Contains => {
                if let (Value::String(a), Value::String(e)) = (actual, expected) {
                    a.contains(e.as_str())
                } else {
                    false
                }
            }
            ValidationOperator::Exists => !actual.is_null(),
            ValidationOperator::Gt => {
                if let (Some(a), Some(e)) = (actual.as_f64(), expected.as_f64()) {
                    a > e
                } else {
                    false
                }
            }
            ValidationOperator::Lt => {
                if let (Some(a), Some(e)) = (actual.as_f64(), expected.as_f64()) {
                    a < e
                } else {
                    false
                }
            }
            ValidationOperator::Gte => {
                if let (Some(a), Some(e)) = (actual.as_f64(), expected.as_f64()) {
                    a >= e
                } else {
                    false
                }
            }
            ValidationOperator::Lte => {
                if let (Some(a), Some(e)) = (actual.as_f64(), expected.as_f64()) {
                    a <= e
                } else {
                    false
                }
            }
            _ => false,
        }
    }

    fn extract_field(json: &Value, path: &str) -> Option<Value> {
        let parts: Vec<&str> = path.split('.').collect();
        let mut current = json;

        for part in parts {
            current = current.get(part)?;
        }

        Some(current.clone())
    }
}
