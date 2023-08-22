# Benchmarking Work Queue Management

This is a simple lambda that allows the use of sqs queues by benchmark workers.

## API

### POST /:queueId

Submit a job to a queue. The queue will be created if it doesn't exist already.

```bash
curl  -X POST \
  'https://<lambda-url-id>.lambda-url.us-east-2.on.aws/<queue-id>' \
  --header 'Benchmark-Api-Key: <api-key>' \
  --header 'Content-Type: application/json' \
  --data '{"example": "data"}'
```

#### Response

```json
{
  "message": "Message sent"
}
```

### GET /:queueId

Get a job from a queue. The queue will be created if it doesn't exist already.

```bash
curl 'https://<lambda-url-id>.lambda-url.us-east-2.on.aws/<queue-id>' \
  --header 'Benchmark-Api-Key: <api-key>'
```

#### Response

```json
{
  "messageId": "1234567890",
  "body": "{\"example\": \"data\"}"
}
```

### DELETE /:queueId/:messageId

Delete a job from a queue. You must do this when done processing a particular job, or it will be handed out again after 5 minutes.

```bash
curl -X DELETE \
  'https://<lambda-url-id>.lambda-url.us-east-2.on.aws/<queue-id>/<message-id>' \
  --header 'Benchmark-Api-Key: <api-key>'
```

#### Response

```json
{
  "message": "Message deleted"
}
```