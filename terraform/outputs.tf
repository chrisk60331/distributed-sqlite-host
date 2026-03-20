output "service_url" {
  description = "App Runner service URL."
  value       = module.apprunner.service_url
}

output "service_arn" {
  description = "App Runner service ARN."
  value       = module.apprunner.service_arn
}

output "ecr_repository_url" {
  description = "ECR repository URL."
  value       = module.ecr.repository_url
}

output "ecr_push_commands" {
  description = "Helper commands to build and push the image."
  value = [
    "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${module.ecr.repository_url}",
    "docker buildx build --platform linux/amd64 -f docker/dockerfile.dev -t liteloft .",
    "docker tag liteloft:latest ${module.ecr.repository_url}:${var.environment}-${var.ecr_image_tag}",
    "docker push ${module.ecr.repository_url}:${var.environment}-${var.ecr_image_tag}"
  ]
}
