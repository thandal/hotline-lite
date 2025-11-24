SERVICE_SID=ZS5845044ef796db5f7e53c3a7e34e43d8

echo "Cleaning up builds..."
twilio api:serverless:v1:services:builds:list --service-sid $SERVICE_SID \
  | tail -n +2 \
  | awk '{ print $1 }' \
  | xargs -L 1 twilio api:serverless:v1:services:builds:remove --service-sid $SERVICE_SID --sid

twilio api:serverless:v1:services:builds:list --service-sid $SERVICE_SID

echo "Cleaning up assets..."
twilio api:serverless:v1:services:assets:list --service-sid $SERVICE_SID \
  | tail -n +2 \
  | awk '{ print $1 }' \
  | xargs -L 1 twilio api:serverless:v1:services:assets:remove --service-sid $SERVICE_SID --sid

twilio api:serverless:v1:services:assets:list --service-sid $SERVICE_SID
