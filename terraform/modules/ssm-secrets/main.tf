locals {
  # Only create SSM parameters for secrets with non-empty values (AWS requires length >= 1)
  secret_keys = nonsensitive(toset([for k, v in var.secrets : k if length(var.secrets[k]) >= 1]))
}

resource "aws_ssm_parameter" "secret" {
  for_each = local.secret_keys

  name        = "/${var.app_name}/${var.environment}/${each.key}"
  description = "${each.key} for ${var.app_name}-${var.environment}"
  type        = "SecureString"
  value       = var.secrets[each.key]

  tags = {
    App         = var.app_name
    Environment = var.environment
  }
}
