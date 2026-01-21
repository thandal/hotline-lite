#!/bin/bash

# Phone numbers can be found at https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
# Services can be found at https://console.twilio.com/us1/develop/functions/services
# Workspaces can be found at https://console.twilio.com/us1/develop/taskrouter/workspaces

SERVICE_FRIENDLY_NAME=twilio-hotline
WORKSPACE_FRIENDLY_NAME=twilio-workspace

if [[ `twilio plugins | grep "plugin-serverless"` == "" ]]
then
    echo "Installing Twilio Serverless plugin..."
    twilio plugins:install @twilio-labs/plugin-serverless
fi

if [[ `twilio profiles:list | grep "AC*"` == "" ]]
then
    twilio login
else
    twilio profiles:list
fi

read -p "Enter the shorthand identifier of your Twilio CLI profile (or press enter to use a new profile): " PROFILE_NAME

if [[ -z "$PROFILE_NAME" ]]
then
    twilio login
    PROFILE_NAME=`twilio profiles:list | tail -n 1 | awk '{ print $1 }'`
fi
twilio profiles:use $PROFILE_NAME

echo Checking for a twilio phone number...
PHONE_NUMBER_SID=`twilio api:core:incoming-phone-numbers:list \
    | tail -n 1 | awk '{ print $1 }'`
PHONE_NUMBER=`twilio api:core:incoming-phone-numbers:list \
    | tail -n 1 | awk '{ print $2 }'`
if [[ "$PHONE_NUMBER_SID" ]]
then
    read -p "Do you want to use `twilio api:core:incoming-phone-numbers:list | tail -n 1 | awk '{print $3 " " $4}'` for the hotline? (y/n) " -n 1 -r REPLY
    echo    # (optional) move to a new line
    echo    # (optional) move to a new line
fi

if [[ -z "$PHONE_NUMBER_SID" || ! $REPLY =~ ^[Yy]$ ]]
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

echo "HOTLINE_PHONE_NUMBER=\"$PHONE_NUMBER\"" > twilio-hotline/.env
echo "Using $PHONE_NUMBER"

echo Initially deploying service...
(cd twilio-hotline; twilio serverless:deploy)

#echo SERVICE friendly name: $SERVICE_FRIENDLY_NAME
SERVICE_SID=`twilio api:serverless:v1:services:list | grep " $SERVICE_FRIENDLY_NAME " | awk '{ print $1 }'`
if [ ${#SERVICE_SID} != 34 ]
then
    echo "Service SID not found"
    exit
fi
#echo Service SID: $SERVICE_SID

# Find the environment
ENVIRONMENT_SID=`twilio api:serverless:v1:services:environments:list \
    --service-sid $SERVICE_SID \
    | grep "dev-environment" | awk '{ print $1 }'`
if [ ${#ENVIRONMENT_SID} != 34 ]
then
    echo "Environment SID not found"
    exit
fi
#echo Environment SID: $ENVIRONMENT_SID

# Find the languages used on the hotline
LANGUAGES_SID=`twilio api:serverless:v1:services:environments:variables:list \
    --service-sid $SERVICE_SID \
    --environment-sid $ENVIRONMENT_SID \
    | grep "LANGUAGES" | awk '{ print $1 }'`
if [ ${#LANGUAGES_SID} == 34 ]
then
    DEFAULT_LANGUAGES=`twilio api:serverless:v1:services:environments:variables:fetch \
        --service-sid $SERVICE_SID \
        --environment-sid $ENVIRONMENT_SID \
        --sid $LANGUAGES_SID \
        --properties value \
        | tail -n 1`
fi
if [ -z "$DEFAULT_LANGUAGES" ]
then
    DEFAULT_LANGUAGES="es,en"
fi
read -p "What languages does your hotline provide? List them in order of priority. (Press enter to use: $DEFAULT_LANGUAGES): " LANGUAGES
LANGUAGES=${LANGUAGES:-$DEFAULT_LANGUAGES}
echo "LANGUAGES=\"$LANGUAGES\"" >> twilio-hotline/.env
#echo Languages: $LANGUAGES

# Find the service domain base for callback functions
SERVICE_DOMAIN_BASE=`twilio api:serverless:v1:services:list \
    --properties="sid,friendlyName,domainBase" \
    | grep " $SERVICE_FRIENDLY_NAME " | awk '{ print $3 }' `
#echo Service domain base: $SERVICE_DOMAIN_BASE

#echo WORKSPACE friendly name: $WORKSPACE_FRIENDLY_NAME

# Check for an existing workspace
WORKSPACE_SID=`twilio api:taskrouter:v1:workspaces:list \
    --friendly-name $WORKSPACE_FRIENDLY_NAME \
    --properties sid \
    | tail -n 1`
if [ ${#WORKSPACE_SID} != 34 ]
then
    # Create a new workspace
    WORKSPACE_SID=`twilio api:taskrouter:v1:workspaces:create \
        --friendly-name $WORKSPACE_FRIENDLY_NAME \
        --template FIFO \
        --properties sid \
        | tail -n 1`
fi
if [ ${#WORKSPACE_SID} != 34 ]
then
    echo "Workspace SID not found"
    exit
fi
echo "WORKSPACE_SID=\"$WORKSPACE_SID\"" >> twilio-hotline/.env
#echo Workspace SID: $WORKSPACE_SID

WORKFLOW_SID=`twilio api:taskrouter:v1:workspaces:workflows:list \
    --workspace-sid $WORKSPACE_SID \
    | tail -n 1 | awk '{ print $1 }'`
echo "WORKFLOW_SID=\"$WORKFLOW_SID\"" >> twilio-hotline/.env
#echo Workflow SID: $WORKFLOW_SID

QUEUE_SID=`twilio api:taskrouter:v1:workspaces:task-queues:list \
    --workspace-sid $WORKSPACE_SID \
    | tail -n 1 | awk '{ print $1 }'`
#echo Queue SID: $QUEUE_SID

# Check for an existing environment
ENVIRONMENT_SID=`twilio api:serverless:v1:services:environments:list \
    --service-sid $SERVICE_SID \
    --properties sid,uniqueName \
    | grep "dev-environment" | awk '{ print $1 }'`
if [ ${#ENVIRONMENT_SID} != 34 ]
then
    ENVIRONMENT_SID=`twilio api:serverless:v1:services:environments:create \
        --service-sid $SERVICE_SID \
        --unique-name "dev-environment" \
        --domain-suffix "dev" \
        | tail -n 1 | awk '{ print $1 }'`
fi
#echo Environment SID: $ENVIRONMENT_SID

# Check for an existing blocklist
BLOCKLIST_SID=`twilio api:serverless:v1:services:environments:variables:list \
    --service-sid $SERVICE_SID \
    --environment-sid $ENVIRONMENT_SID \
    | grep "BLOCKLIST" | awk '{ print $1 }'`
if [ ${#BLOCKLIST_SID} != 34 ]
then
    BLOCKLIST_SID=`twilio api:serverless:v1:services:environments:variables:create \
        --service-sid $SERVICE_SID \
        --environment-sid $ENVIRONMENT_SID \
        --key "BLOCKLIST" \
        --value "null" \
        | tail -n 1 | awk '{ print $1 }'`
fi
#echo Blocklist SID: $BLOCKLIST_SID

# Configure the workspace workflow (assignment-callback-url is a little brittle!)
# Most phones go to voicemail after 20 seconds, so we set the task reservation timeout to avoid that.
echo  # (optional) move to a new line
echo "Configuring the workflow..."
WORKFLOW_CONFIGURATION=`cat workflow.json | jq -rca . | jq -R | sed s/QUEUE_SID/$QUEUE_SID/g`
twilio api:taskrouter:v1:workspaces:workflows:update \
    --workspace-sid $WORKSPACE_SID \
    --sid $WORKFLOW_SID \
    --assignment-callback-url="https://$SERVICE_DOMAIN_BASE-dev.twil.io/queue/assignment" \
    --task-reservation-timeout 20 \
    --configuration "$WORKFLOW_CONFIGURATION"

echo  # (optional) move to a new line
echo "Configuring the task queue..."
twilio api:taskrouter:v1:workspaces:task-queues:update \
    --workspace-sid $WORKSPACE_SID \
    --sid $QUEUE_SID \
    --max-reserved-workers=50

# Check for an existing list of operators
echo  # (optional) move to a new line
echo "Configuring the operator list..."
read -p "Enter the path to a JSONL file containing an updated operator list or press enter to keep the current list: " ROSTER_FILE
echo    # (optional) move to a new line
if [[ -n "$ROSTER_FILE" ]]
then
    echo Updating operator list with $ROSTER_FILE...
    REGISTERED_WORKERS=`twilio api:serverless:v1:services:environments:variables:list \
        --service-sid $SERVICE_SID \
        --environment-sid $ENVIRONMENT_SID \
        | grep -i "WORKER" | awk '{ print $2,$1 }'`

    while read -r line; do
        WORKER_NAME=worker`echo $line | sed -nr "s/^.*\+1[0-9]{6}([0-9]{4}).*$/\1/p"`
        WORKER_NAMES+=($WORKER_NAME)
        WORKER_ATTRIBUTES=$line
        # echo "$WORKER_NAME=\"$WORKER_ATTRIBUTES\"" >> twilio-hotline/.env
        if [[ "$REGISTERED_WORKERS" == *"$WORKER_NAME"* ]]
        then
            echo "Worker $WORKER_NAME already registered, attempting to update attributes..."
            WORKER_SID=`echo "$REGISTERED_WORKERS" | grep -i "$WORKER_NAME" | awk '{ print $2 }'`
            twilio api:serverless:v1:services:environments:variables:update \
                --service-sid $SERVICE_SID \
                --environment-sid $ENVIRONMENT_SID \
                --sid $WORKER_SID \
                --key $WORKER_NAME \
                --value "$WORKER_ATTRIBUTES"
        else
            echo "Adding new worker: $WORKER_NAME"
            twilio api:serverless:v1:services:environments:variables:create \
                --service-sid $SERVICE_SID \
                --environment-sid $ENVIRONMENT_SID \
                --key $WORKER_NAME \
                --value "$WORKER_ATTRIBUTES"
        fi
    done < $ROSTER_FILE

    # Check the current workers, deleting any that are not in the "new" list.
    echo "$REGISTERED_WORKERS" | while read -r line; do
        if ! echo ${WORKER_NAMES[@]} | grep -qw "$(echo $line | awk '{ print $1 }')"
        then
            WORKER_SID=$(echo $line | awk '{ print $2 }')
            twilio api:serverless:v1:services:environments:variables:remove \
                --service-sid $SERVICE_SID \
                --environment-sid $ENVIRONMENT_SID \
                --sid $WORKER_SID
            echo "Removed worker $(echo $line | awk '{ print $1 }')"
        fi
    done
fi

# Check for an existing shift calendar
echo  # (optional) move to a new line
echo "Configuring the operator shift calendar..."
ICS_URL_SID=`twilio api:serverless:v1:services:environments:variables:list \
    --service-sid $SERVICE_SID \
    --environment-sid $ENVIRONMENT_SID \
    | grep "ICS_URL" | awk '{ print $1 }'`
if [ ${#ICS_URL_SID} == 34 ]
then
    ICS_URL=`twilio api:serverless:v1:services:environments:variables:fetch \
            --service-sid $SERVICE_SID \
            --environment-sid $ENVIRONMENT_SID \
            --sid $ICS_URL_SID \
            --properties value \
            | tail -n 1`
    echo "Current ICS calendar URL: $ICS_URL"
    read -p "Enter the ICS calendar URL for operator shifts (or press enter to use the URL listed above): " NEW_ICS_URL
    echo    # (optional) move to a new line
    echo    # (optional) move to a new line
fi
if [[ ${#ICS_URL_SID} != 34 || $NEW_ICS_URL != "" ]]
then
    if [[ $ICS_URL == "" ]]
    then
        read -p "Enter the ICS calendar URL for operator shifts: " NEW_ICS_URL
    fi
    ICS_URL=${NEW_ICS_URL:-$ICS_URL}
    ICS_URL_SID=`twilio api:serverless:v1:services:environments:variables:create \
        --service-sid $SERVICE_SID \
        --environment-sid $ENVIRONMENT_SID \
        --key "ICS_URL" \
        --value "$ICS_URL" \
        | tail -n 1 | awk '{ print $1 }'`
fi
# echo ICS URL SID: $ICS_URL_SID
echo "ICS_URL=\"$ICS_URL\"" >> twilio-hotline/.env

# Deploy the service again to pick up any changes to environment variables
echo "Re-deploying the service with configuration..."
(cd twilio-hotline; twilio serverless:deploy)

# Configure the phone number
echo  # (optional) move to a new line
echo "Configuring the phone number callbacks..."
twilio api:core:incoming-phone-numbers:update \
    --sid $PHONE_NUMBER_SID \
    --voice-url="https://$SERVICE_DOMAIN_BASE-dev.twil.io/hotline" \
    --status-callback="https://$SERVICE_DOMAIN_BASE-dev.twil.io/clearCalls"

echo  # (optional) move to a new line
echo "Done!"