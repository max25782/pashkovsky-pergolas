---
name: create-bedrock-agent
description: Create and configure Amazon Bedrock Agents using Terraform or Python Boto3. Use when the user asks to create, deploy, or setup a Bedrock Agent, or mentions "Bedrock Agent" in a creation context.
---

# Create Amazon Bedrock Agent

## Prerequisites
Before creating an agent, ensure the following IAM permissions are ready:
1. **Agent Role**: A service role allowing `bedrock.amazonaws.com` to assume it.
2. **Model Access**: The account must have access to the foundation model (e.g., Anthropic Claude).

## Workflow

1. **Determine Implementation Method**:
   - If the user uses Infrastructure as Code (IaC) -> Use **Terraform** patterns.
   - If the user wants a script or programmatic creation -> Use **Python (Boto3)** patterns.

2. **Select Components**:
   - **Agent**: The core orchestrator.
   - **Action Group**: (Optional) For executing tasks via Lambda.
   - **Knowledge Base**: (Optional) For RAG capabilities.

## Terraform Implementation
See [terraform.md](terraform.md) for resource definitions.

## Python (Boto3) Implementation
See [python.md](python.md) for SDK usage examples.

## Validation
After creation, always advise the user to:
1. **Prepare** the agent (create a draft version).
2. **Test** in the AWS Console or via `invoke_agent` API using the `DRAFT` alias.
