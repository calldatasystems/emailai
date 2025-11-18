# EmailAI Production Environment Variables

variable "project_name" {
  description = "Project name for resource tagging"
  type        = string
  default     = "emailai"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "stg"
}

# VPC Configuration
variable "existing_vpc_id" {
  description = "ID of existing VPC to use (leave empty to create new VPC)"
  type        = string
  default     = "vpc-07d54189eee51b854"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.10.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones for subnets"
  type        = list(string)
  default     = ["us-east-2a", "us-east-2b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.10.1.0/24", "10.10.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.10.11.0/24", "10.10.12.0/24"]
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed for SSH access (not used, using SSM instead)"
  type        = list(string)
  default     = []
}

# EC2 Instance Configuration
variable "instance_count" {
  description = "Number of EmailAI instances"
  type        = number
  default     = 2
}

variable "instance_type" {
  description = "EC2 instance type for EmailAI servers"
  type        = string
  default     = "t3.medium"
}

variable "root_volume_size" {
  description = "Root volume size in GB"
  type        = number
  default     = 30
}

# Database Configuration
variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "emailai_prod"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "emailai_admin"
}

variable "db_password" {
  description = "PostgreSQL master password (set via environment variable or terraform.tfvars)"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.15"
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
}

# ALB Configuration
variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS (leave empty for HTTP only)"
  type        = string
  default     = ""
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for ALB"
  type        = bool
  default     = false
}
