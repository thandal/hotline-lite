#!/bin/bash
ENV_FILE="twilio-hotline/.env"
source $ENV_FILE

if [ ${#SERVICE_SID} != 34 ]
then
    echo "Service SID not found. Run ./setup_hotline.sh first to set up your hotline, or ensure that SERVICE_SID is included in your .env file at twilio-hotline/.env."
    exit
fi

if [ ${#ENVIRONMENT_SID} != 34 ]
then
    echo "Environment SID not found. Run ./setup_hotline.sh first to set up your hotline, or ensure that ENVIRONMENT_SID is included in your .env file at twilio-hotline/.env."
    exit
fi


#twilio api:serverless:v1:services:environments:list --service-sid $SERVICE_SID

echo "Fetching environment variables..."
twilio api:serverless:v1:services:environments:variables:list --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID --properties=key,value
