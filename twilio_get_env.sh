#SERVICE_SID=ZS5845044ef796db5f7e53c3a7e34e43d8
SERVICE_SID=ZS8ed6db191546b9aac14282790f6eb6a9
ENVIRONMENT_SID=ZEd89debfc86b0818b06b5d2242a22a062

#twilio api:serverless:v1:services:environments:list --service-sid $SERVICE_SID

echo "Fetching environment variables..."
twilio api:serverless:v1:services:environments:variables:list --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID --properties=key,value
