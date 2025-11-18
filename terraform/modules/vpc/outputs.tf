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
  value       = aws_internet_gateway.main.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "public_route_table_id" {
  description = "Public route table ID"
  value       = aws_route_table.public.id
}

output "wazo_security_group_id" {
  description = "Security group ID for Wazo servers"
  value       = aws_security_group.wazo.id
}

output "litellm_security_group_id" {
  description = "Security group ID for LiteLLM AI Gateway"
  value       = aws_security_group.litellm.id
}

output "alb_security_group_id" {
  description = "Security group ID for Application Load Balancer"
  value       = aws_security_group.alb.id
}

output "emailai_security_group_id" {
  description = "Security group ID for EmailAI application servers"
  value       = aws_security_group.emailai.id
}
