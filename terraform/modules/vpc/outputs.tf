# VPC Module Outputs

output "vpc_id" {
  description = "VPC ID"
  value       = local.vpc_id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = var.existing_vpc_id != "" ? data.aws_vpc.existing[0].cidr_block : aws_vpc.main[0].cidr_block
}

output "internet_gateway_id" {
  description = "Internet Gateway ID"
  value       = local.use_existing ? data.aws_internet_gateway.existing[0].id : aws_internet_gateway.main[0].id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = local.use_existing ? data.aws_subnet.existing_public[*].id : aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = local.use_existing ? data.aws_subnet.existing_private[*].id : aws_subnet.private[*].id
}

output "public_route_table_id" {
  description = "Public route table ID"
  value       = local.create_new ? aws_route_table.public[0].id : null
}

output "wazo_security_group_id" {
  description = "Security group ID for Wazo servers"
  value       = local.use_existing ? data.aws_security_group.existing_wazo[0].id : aws_security_group.wazo[0].id
}

output "litellm_security_group_id" {
  description = "Security group ID for LiteLLM AI Gateway"
  value       = local.use_existing ? data.aws_security_group.existing_litellm[0].id : aws_security_group.litellm[0].id
}

output "alb_security_group_id" {
  description = "Security group ID for Application Load Balancer"
  value       = local.use_existing ? data.aws_security_group.existing_alb[0].id : aws_security_group.alb[0].id
}

output "emailai_security_group_id" {
  description = "Security group ID for EmailAI application servers"
  value       = local.use_existing ? data.aws_security_group.existing_emailai[0].id : aws_security_group.emailai[0].id
}
