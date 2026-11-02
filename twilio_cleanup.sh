#!/bin/bash
ENV_FILE="twilio-hotline/.env"
source $ENV_FILE

if [ ${#SERVICE_SID} != 34 ]
then
    echo "Service SID not found. Run ./setup_hotline.sh first to set up your hotline, or ensure that SERVICE_SID is included in your .env file at twilio-hotline/.env."
    exit
fi

echo "Cleaning up builds..."
twilio api:serverless:v1:services:builds:list --service-sid $SERVICE_SID \
  | tail -n +2 \
  | awk '{ print $1 }' \
  | xargs -L 1 twilio api:serverless:v1:services:builds:remove --service-sid $SERVICE_SID --sid

echo "Cleaning up assets..."
twilio api:serverless:v1:services:assets:list --service-sid $SERVICE_SID \
  | tail -n +2 \
  | awk '{ print $1 }' \
  | xargs -L 1 twilio api:serverless:v1:services:assets:remove --service-sid $SERVICE_SID --sid

# After cleanup, list builds and assets
twilio api:serverless:v1:services:builds:list --service-sid $SERVICE_SID
twilio api:serverless:v1:services:assets:list --service-sid $SERVICE_SID
