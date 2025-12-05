#!/bin/bash

# Phone numbers can be found at https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
# Services can be found at https://console.twilio.com/us1/develop/functions/services
# Workspaces can be found at https://console.twilio.com/us1/develop/taskrouter/workspaces

SERVICE_FRIENDLY_NAME=twilio-hotline
WORKSPACE_FRIENDLY_NAME=twilio-workspace

twilio plugins:install @twilio-labs/plugin-serverless
twilio login
read -p "Enter the shorthand identifier of your Twilio CLI profile (or press enter to use 'hotline'): " PROFILE_NAME
twilio profiles:use ${PROFILE_NAME:-hotline}

echo Checking for a twilio phone number...
PHONE_NUMBER_SID=`twilio api:core:incoming-phone-numbers:list | tail -n 1 | awk '{ print $1 }'`
PHONE_NUMBER=`twilio api:core:incoming-phone-numbers:list | tail -n 1 | awk '{ print $2 }'`
read -p "Is this the correct phone number for the hotline? (y/n) " -n 1 -r REPLY
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "This account owns the following phone numbers:"
    twilio api:core:incoming-phone-numbers:list
    read -p "Enter the phone number in E.164 format (e.g. +15405340500) that you want to use or press enter to find a new number: " PHONE_NUMBER
    PHONE_NUMBER_SID=`twilio api:core:incoming-phone-numbers:list \
        --phone-number $PHONE_NUMBER \
        | tail -n 1 | awk '{ print $1 }'`
    if [ -z "$PHONE_NUMBER_SID" ]
    then
        read -p "Enter the area code you want (e.g. 202): " AREA_CODE
        echo "Here are a list of available phone numbers with area code $AREA_CODE:"
        twilio api:core:available-phone-numbers:local:list \
            --country-code US \
            --area-code $AREA_CODE \
            --contains 00$ 
        read -p "Enter the phone number you want in E.164 format (e.g. +15405340500): " PHONE_NUMBER
        PHONE_NUMBER_SID=`twilio api:core:incoming-phone-numbers:create \
            --phone-number $PHONE_NUMBER \
            --property sid \
            | tail -n 1 | awk '{ print $1 }'`
        if [ -z "$PHONE_NUMBER_SID" ]
        then
            echo "Could not buy phone number $PHONE_NUMBER. Please try again or buy a phone number at https://console.twilio.com."
            exit 1
        fi
    fi
fi
echo Using $PHONE_NUMBER

echo Initially deploying service
(cd twilio-hotline; twilio serverless:deploy)

echo SERVICE friendly name: $SERVICE_FRIENDLY_NAME
SERVICE_SID=`twilio api:serverless:v1:services:list | grep " $SERVICE_FRIENDLY_NAME " | awk '{ print $1 }'`
if [ ${#SERVICE_SID} != 34 ]
then
        echo "Service SID not found"
        exit
fi
echo Service SID: $SERVICE_SID

# Find the environment
ENVIRONMENT_SID=`twilio api:serverless:v1:services:environments:list --service-sid $SERVICE_SID | grep "dev-environment" | awk '{ print $1 }'`
if [ ${#ENVIRONMENT_SID} != 34 ]
then
        echo "Environment SID not found"
        exit
fi
echo Environment SID: $ENVIRONMENT_SID

# Create an empty BLOCKLIST variable in the environment
twilio api:serverless:v1:services:environments:variables:create \
        --service-sid $SERVICE_SID \
        --environment-sid $ENVIRONMENT_SID \
        --key BLOCKLIST \
        --value "null"

# Find the service domain base for callback functions
SERVICE_DOMAIN_BASE=`twilio api:serverless:v1:services:list --properties="sid,friendlyName,domainBase" | grep " $SERVICE_FRIENDLY_NAME " | awk '{ print $3 }' `
echo Service domain base: $SERVICE_DOMAIN_BASE

echo WORKSPACE friendly name: $WORKSPACE_FRIENDLY_NAME

# Check for an existing workspace
WORKSPACE_SID=`twilio api:taskrouter:v1:workspaces:list --friendly-name $WORKSPACE_FRIENDLY_NAME --properties sid | tail -n 1`
if [ ${#WORKSPACE_SID} != 34 ]
then
        # Create a new workspace
        WORKSPACE_SID=`twilio api:taskrouter:v1:workspaces:create --friendly-name $WORKSPACE_FRIENDLY_NAME --template FIFO --properties sid | tail -n 1`
fi
if [ ${#WORKSPACE_SID} != 34 ]
then
        echo "Workspace SID not found"
        exit
fi
echo Workspace SID: $WORKSPACE_SID

WORKFLOW_SID=`twilio api:taskrouter:v1:workspaces:workflows:list  --workspace-sid $WORKSPACE_SID | tail -n 1 | awk '{ print $1 }'`
echo Workflow SID: $WORKFLOW_SID

QUEUE_SID=`twilio api:taskrouter:v1:workspaces:task-queues:list  --workspace-sid $WORKSPACE_SID | tail -n 1 | awk '{ print $1 }'`
echo Queue SID: $QUEUE_SID

# Check for an existing environment
ENVIRONMENT_SID=`twilio api:serverless:v1:services:environments:list --service-sid $SERVICE_SID --properties sid,uniqueName | grep "dev-environment" | awk '{ print $1 }'`
if [ ${#ENVIRONMENT_SID} != 34 ]
then
        ENVIRONMENT_SID=`twilio api:serverless:v1:services:environments:create --service-sid $SERVICE_SID --unique-name "dev-environment" --domain-suffix "dev" | tail -n 1 | awk '{ print $1 }'`
fi
echo Environment SID: $ENVIRONMENT_SID

# Check for an existing blocklist
BLOCKLIST_SID=`twilio api:serverless:v1:services:environments:variables:list --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID | grep "BLOCKLIST" | awk '{ print $1 }'`
if [ ${#BLOCKLIST_SID} != 34 ]
then
        BLOCKLIST_SID=`twilio api:serverless:v1:services:environments:variables:create --service-sid $SERVICE_SID --environment-sid $ENVIRONMENT_SID --key "BLOCKLIST" --value "null" | tail -n 1 | awk '{ print $1 }'`
fi
echo Blocklist SID: $BLOCKLIST_SID

# Configure the workspace workflow (assignment-callback-url is a little brittle!)
# Most phones go to voicemail after 20 seconds, so we set the task reservation timeout to avoid that.
echo "Configuring the workflow..."
twilio api:taskrouter:v1:workspaces:workflows:update \
        --workspace-sid $WORKSPACE_SID \
        --sid $WORKFLOW_SID \
        --assignment-callback-url="https://$SERVICE_DOMAIN_BASE-dev.twil.io/queue/assignment" \
        --task-reservation-timeout 20 \
        --configuration "{\"task_routing\":{\"filters\":[{\"filter_friendly_name\":\"SimpleFilter\",\"expression\":\"1==1\",\"targets\":[{\"queue\":\"$QUEUE_SID\",\"expression\":\"task.language IN worker.languages\"},{\"queue\":\"$QUEUE_SID\",\"order_by\":\"worker.tier ASC\"}]}],\"default_filter\":{\"queue\":\"$QUEUE_SID\"}}}"

echo "Configuring the task queue..."
twilio api:taskrouter:v1:workspaces:task-queues:update \
        --workspace-sid $WORKSPACE_SID \
        --sid $QUEUE_SID \
        --max-reserved-workers=5

echo "Updating twilio-hotline/.env..."
echo "HOTLINE_PHONE_NUMBER=\"$PHONE_NUMBER\"" > twilio-hotline/.env
echo "WORKSPACE_SID=\"$WORKSPACE_SID\"" >> twilio-hotline/.env
echo "WORKFLOW_SID=\"$WORKFLOW_SID\"" >> twilio-hotline/.env

echo "Re-deploying the service with cd twilio-hotline; twilio serverless:deploy"
(cd twilio-hotline; twilio serverless:deploy)

# Configure the phone number
echo "Configuring the phone number callbacks..."
twilio api:core:incoming-phone-numbers:update \
        --sid $PHONE_NUMBER_SID \
        --voice-url="https://$SERVICE_DOMAIN_BASE-dev.twil.io/hotline" \
        --status-callback="https://$SERVICE_DOMAIN_BASE-dev.twil.io/clearCalls"

echo "Done!"
