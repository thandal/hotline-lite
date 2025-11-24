#!/bin/bash

# By default, report the current value of the BLOCKLIST
# To update use ./manage_blocklist.sh --update foo.txt
# The blocklist must be all one line, with phone numbers in the form
# +1234567890 separated only by commas.

# Services can be found at https://console.twilio.com/us1/develop/functions/services

SERVICE_FRIENDLY_NAME=twilio-hotline

echo SERVICE friendly name: $SERVICE_FRIENDLY_NAME
SERVICE_SID=`twilio api:serverless:v1:services:list | grep " $SERVICE_FRIENDLY_NAME " | awk '{ print $1 }'`
if [ ${#SERVICE_SID} != 34 ]
then
        echo "Service SID not found"
        echo "NOTE: Before using update_blocklist.sh, you must set up the service."
        exit
fi
echo Service SID: $SERVICE_SID

# Find the environment
ENVIRONMENT_SID=`twilio api:serverless:v1:services:environments:list --service-sid $SERVICE_SID | grep "dev-environment" | awk '{ print $1 }'`
if [ ${#ENVIRONMENT_SID} != 34 ]
then
        echo "Environment SID not found"
        echo "NOTE: Before using update_blocklist.sh, you must set up the service."
        exit
fi
echo Environment SID: $ENVIRONMENT_SID

# Find the blocklist sid
BLOCKLIST_SID=`twilio api:serverless:v1:services:environments:variables:list --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID | grep "BLOCKLIST" | awk '{ print $1 }'`
if [ ${#BLOCKLIST_SID} != 34 ]
then
        echo "BLOCKLIST SID not found"
        echo "Creating the BLOCKLIST env variable"
        twilio api:serverless:v1:services:environments:variables:create --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID --key BLOCKLIST --value "" 
        echo "Please run this script again!"
        exit
fi
echo BLOCKLIST SID: $BLOCKLIST_SID

# Get the current blocklist value
twilio api:serverless:v1:services:environments:variables:fetch --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID --sid $BLOCKLIST_SID --properties value

if [[ $# -eq 2 && $1 == "--update" ]]
then
  NEW_BLOCKLIST=`cat $2`
  echo Updating BLOCKLIST to $NEW_BLOCKLIST
  twilio api:serverless:v1:services:environments:variables:update --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID --sid $BLOCKLIST_SID --value "$NEW_BLOCKLIST" > /dev/null
fi
