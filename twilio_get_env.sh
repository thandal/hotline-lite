# Hotline-lite
SERVICE_SID=
ENVIRONMENT_SID=


#twilio api:serverless:v1:services:environments:list --service-sid $SERVICE_SID

echo "Fetching environment variables..."
twilio api:serverless:v1:services:environments:variables:list --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID --properties=key,value
