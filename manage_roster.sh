#!/bin/bash

# By default, report the current value of the ROSTER
# To update use ./manage_roster.sh --update foo.json
# The roster file must be all one line, see roster_example.json.

# Services can be found at https://console.twilio.com/us1/develop/functions/    services

SERVICE_FRIENDLY_NAME=twilio-hotline

echo SERVICE friendly name: $SERVICE_FRIENDLY_NAME
SERVICE_SID=`twilio api:serverless:v1:services:list | grep "$SERVICE_FRIENDLY_NAME " | awk '{ print $1 }'`
if [ ${#SERVICE_SID} != 34 ]
then
        echo "Service SID not found"
        echo "NOTE: Before using update_roster.sh, you must set up the service."
        exit
fi
echo Service SID: $SERVICE_SID

# Find the environment
ENVIRONMENT_SID=`twilio api:serverless:v1:services:environments:list --service-sid $SERVICE_SID | grep "dev-environment" | awk '{ print $1 }'`
if [ ${#ENVIRONMENT_SID} != 34 ]
then
        echo "Environment SID not found"
        echo "NOTE: Before using update_roster.sh, you must set up the service."
        exit
fi
echo Environment SID: $ENVIRONMENT_SID

# Find the roster sid
ROSTER_SID=`twilio api:serverless:v1:services:environments:variables:list --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID | grep "ROSTER"  | awk '{ print $1 }'`
if [ ${#ROSTER_SID} != 34 ]
then
        echo "ROSTER SID not found"
        echo "Creating the ROSTER env variable"
        twilio api:serverless:v1:services:environments:variables:create --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID --key ROSTER --value "{}"
        echo "Please run this script again!"
        exit
fi
echo ROSTER SID: $ROSTER_SID

# Get the current roster value
twilio api:serverless:v1:services:environments:variables:fetch --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID --sid $ROSTER_SID --properties value

if [[ $# -eq 2 && $1 == "--update" ]]
then
  NEW_ROSTER=`cat $2`
  echo Updating ROSTER to $NEW_ROSTER
  twilio api:serverless:v1:services:environments:variables:update --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID --sid $ROSTER_SID --value "$NEW_ROSTER" > /dev/null
fi
