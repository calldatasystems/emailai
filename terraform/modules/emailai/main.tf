# EmailAI Module - Creates EmailAI server instances with Docker

# Data source to get latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# IAM Role for EC2 instances (for SSM access and CloudWatch)
resource "aws_iam_role" "emailai" {
  name = "${var.project_name}-${var.environment}-emailai-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-emailai-role"
    Environment = var.environment
  }
}

# Attach SSM policy for Systems Manager access
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.emailai.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Attach CloudWatch policy for logs
resource "aws_iam_role_policy_attachment" "cloudwatch" {
  role       = aws_iam_role.emailai.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Instance profile
resource "aws_iam_instance_profile" "emailai" {
  name = "${var.project_name}-${var.environment}-emailai-profile"
  role = aws_iam_role.emailai.name

  tags = {
    Name        = "${var.project_name}-${var.environment}-emailai-profile"
    Environment = var.environment
  }
}

# EmailAI Server Instances
resource "aws_instance" "emailai" {
  count                  = var.instance_count
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  subnet_id              = element(var.subnet_ids, count.index % length(var.subnet_ids))
  vpc_security_group_ids = var.security_group_ids
  iam_instance_profile   = aws_iam_instance_profile.emailai.name

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    delete_on_termination = true
    encrypted             = true
  }

  # User data script to install Docker and Docker Compose
  user_data = <<-EOF
              #!/bin/bash
              set -e

              # Update system
              dnf update -y

              # Install Docker
              dnf install -y docker
              systemctl enable docker
              systemctl start docker

              # Install Docker Compose
              curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
              chmod +x /usr/local/bin/docker-compose

              # Install git for cloning repo
              dnf install -y git

              # Create app directory
              mkdir -p /opt/emailai
              chown ec2-user:ec2-user /opt/emailai

              # Install CloudWatch agent
              wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
              rpm -U ./amazon-cloudwatch-agent.rpm

              # Signal cloud-init completion
              touch /var/lib/cloud/instance/boot-finished

              echo "Instance preparation complete - ready for deployment" > /var/log/user-data-complete.log
              EOF

  tags = {
    Name        = "${var.project_name}-${var.environment}-emailai-${count.index + 1}"
    Component   = "emailai"
    Role        = "web-server"
    Environment = var.environment
    Instance    = count.index + 1
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Attach instances to target group
resource "aws_lb_target_group_attachment" "emailai" {
  count            = var.instance_count
  target_group_arn = var.target_group_arn
  target_id        = aws_instance.emailai[count.index].id
  port             = var.app_port
}
