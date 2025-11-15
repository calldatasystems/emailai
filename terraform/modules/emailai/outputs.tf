# EmailAI Module Outputs

output "instance_ids" {
  description = "IDs of the EmailAI EC2 instances"
  value       = aws_instance.emailai[*].id
}

output "instance_private_ips" {
  description = "Private IP addresses of the EmailAI instances"
  value       = aws_instance.emailai[*].private_ip
}

output "instance_arns" {
  description = "ARNs of the EmailAI instances"
  value       = aws_instance.emailai[*].arn
}

output "iam_role_arn" {
  description = "ARN of the IAM role attached to instances"
  value       = aws_iam_role.emailai.arn
}

output "iam_instance_profile_arn" {
  description = "ARN of the IAM instance profile"
  value       = aws_iam_instance_profile.emailai.arn
}

output "ssm_commands" {
  description = "AWS Systems Manager commands to connect to instances"
  value = {
    for idx, instance in aws_instance.emailai :
    "instance-${idx + 1}" => "aws ssm start-session --target ${instance.id}"
  }
}
