# EmailAI Production Environment Outputs

# VPC Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

# Database Outputs
output "database_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.database.db_endpoint
}

output "database_name" {
  description = "Database name"
  value       = module.database.db_name
}

output "database_connection_string" {
  description = "PostgreSQL connection string (without password)"
  value       = "postgresql://${var.db_username}:PASSWORD@${module.database.db_endpoint}/${module.database.db_name}?schema=public"
  sensitive   = true
}

# ALB Outputs
output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.alb_dns_name
}

output "alb_url" {
  description = "URL to access EmailAI application"
  value       = var.certificate_arn != "" ? "https://${module.alb.alb_dns_name}" : "http://${module.alb.alb_dns_name}"
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = module.alb.target_group_arn
}

# EC2 Instance Outputs
output "instance_ids" {
  description = "EmailAI instance IDs"
  value       = module.emailai_servers.instance_ids
}

output "instance_private_ips" {
  description = "Private IP addresses of EmailAI instances"
  value       = module.emailai_servers.instance_private_ips
}

output "ssm_connect_commands" {
  description = "Commands to connect to instances via AWS Systems Manager"
  value       = module.emailai_servers.ssm_commands
}

# Deployment Information
output "deployment_info" {
  description = "Information needed for deployment"
  value       = <<-EOT

    ====================================
    EmailAI Production Deployment
    ====================================

    Application URL: ${var.certificate_arn != "" ? "https://${module.alb.alb_dns_name}" : "http://${module.alb.alb_dns_name}"}

    Database:
      Endpoint: ${module.database.db_endpoint}
      Database: ${module.database.db_name}
      Username: ${var.db_username}

      Connection String:
      DATABASE_URL="postgresql://${var.db_username}:YOUR_PASSWORD@${module.database.db_endpoint}/${module.database.db_name}?schema=public"

    EC2 Instances:
      Count: ${var.instance_count}
      Type: ${var.instance_type}
      IDs: ${join(", ", module.emailai_servers.instance_ids)}

    Connect to instances via SSM:
      Instance 1: aws ssm start-session --target ${module.emailai_servers.instance_ids[0]}
      Instance 2: aws ssm start-session --target ${module.emailai_servers.instance_ids[1]}

    Next Steps:
    1. Set environment variables on EC2 instances
    2. Clone EmailAI repository to /opt/emailai
    3. Build and run Docker container with production env vars
    4. Configure DNS to point to ALB: ${module.alb.alb_dns_name}

    AI Models:
      - Models run on Vast.ai servers (separate infrastructure)
      - Set OLLAMA_BASE_URL to point to Vast.ai instance

    ====================================
  EOT
}
