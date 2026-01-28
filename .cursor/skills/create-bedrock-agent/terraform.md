# Terraform for Bedrock Agents

## Basic Agent Resource

```hcl
resource "aws_bedrockagent_agent" "example" {
  agent_name                  = "my-agent-name"
  agent_resource_role_arn     = aws_iam_role.agent_role.arn
  foundation_model            = "anthropic.claude-3-sonnet-20240229-v1:0"
  instruction                 = "You are a helpful assistant that..."
  idle_session_ttl_in_seconds = 600
}

resource "aws_bedrockagent_agent_alias" "live" {
  agent_alias_name = "live"
  agent_id         = aws_bedrockagent_agent.example.id
  description      = "Production alias"
  routing_configuration {
    agent_version = aws_bedrockagent_agent.example.agent_version
  }
}
```

## Agent Action Group (Lambda)

```hcl
resource "aws_bedrockagent_agent_action_group" "example" {
  action_group_name          = "my-action-group"
  agent_id                   = aws_bedrockagent_agent.example.id
  agent_version              = "DRAFT"
  skip_resource_in_use_check = true
  
  action_group_executor {
    lambda = aws_lambda_function.executor.arn
  }

  api_schema {
    payload = file("${path.module}/openapi.yaml")
  }
}
```

## IAM Role Policy (Trust Relationship)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "bedrock.amazonaws.com"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "aws:SourceAccount": "${current_account_id}"
        },
        "ArnLike": {
          "aws:SourceArn": "arn:aws:bedrock:${region}:${account_id}:agent/*"
        }
      }
    }
  ]
}
```
