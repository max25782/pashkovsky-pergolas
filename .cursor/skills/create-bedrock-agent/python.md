# Python (Boto3) for Bedrock Agents

## Create Agent

```python
import boto3

client = boto3.client('bedrock-agent')

response = client.create_agent(
    agentName='my-agent-name',
    agentResourceRoleArn='arn:aws:iam::123456789012:role/service-role/AmazonBedrockExecutionRoleForAgents_example',
    foundationModel='anthropic.claude-3-sonnet-20240229-v1:0',
    instruction='You are a helpful assistant that...',
    idleSessionTTLInSeconds=600
)

agent_id = response['agent']['agentId']
print(f"Created Agent ID: {agent_id}")
```

## Create Action Group

```python
response = client.create_agent_action_group(
    agentId=agent_id,
    agentVersion='DRAFT',
    actionGroupName='my-action-group',
    actionGroupExecutor={
        'lambda': 'arn:aws:lambda:us-east-1:123456789012:function:my-function'
    },
    apiSchema={
        'payload': open('openapi.yaml', 'r').read()
    }
)
```

## Prepare and Create Alias

```python
# 1. Prepare (Create DRAFT version)
client.prepare_agent(agentId=agent_id)

# 2. Create Alias (Deploy)
response = client.create_agent_alias(
    agentId=agent_id,
    agentAliasName='prod',
    description='Production deployment'
)
alias_id = response['agentAlias']['agentAliasId']
print(f"Created Alias ID: {alias_id}")
```
