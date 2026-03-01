#!/bin/bash

echo This script will help you set up a new Signal account using presage-cli.

PRESAGE_BIN="twilio-hotline/assets/presage-cli.private.bin"
PRESAGE_DB="/tmp/presage.db.enc"
ENV_FILE="twilio-hotline/.env"

# Utility for rewriting env variables
set_env_var() {
    local key=$1
    local value=$2
    local file=$3

    # create the file if it doesn't exist
    touch $file

    # Escape value for use in sed (handling / in the value)
    local escaped_value=$(echo "$value" | sed 's/\//\\\//g')

    # If the key exists, replace the entire line
    if grep -q "^${key}=" "$file"; then
        sed -i.bak "s/^${key}=.*/${key}=${escaped_value}/" "$file"
        rm "$file.bak"
    # Otherwise, append the new key-value pair
    else
        echo "${key}=${value}" >> "$file"
    fi
}

# HACK DEBUG
#PRESAGE_PASSPHRASE=`uuidgen`
PRESAGE_PASSPHRASE=a34e34f55-a10f-4b91-b666-f7ebd3d1b25c

echo
echo PRESAGE_PASSPHRASE $PRESAGE_PASSPHRASE
echo

set_env_var "PRESAGE_PASSPHRASE" $PRESAGE_PASSPHRASE $ENV_FILE

PRESAGE_PRE="$PRESAGE_BIN --sqlite-db-path $PRESAGE_DB --passphrase $PRESAGE_PASSPHRASE"

echo
echo $PRESAGE_PRE
echo

echo Checking for a twilio phone number...
PHONE_NUMBER_SID=`twilio api:core:incoming-phone-numbers:list | tail -n 1 | awk '{ print $1 }'`
PHONE_NUMBER=`twilio api:core:incoming-phone-numbers:list | tail -n 1 | awk '{ print $2 }'`

if [ "$PHONE_NUMBER" == " " ]; then
  echo Could not find twilio phone number, exiting.
  exit
fi
echo Using $PHONE_NUMBER

# Check if we're already registered...

#./presage-cli --sqlite-db-path /tmp/presage.db.sqlite list-devices
#./presage-cli --sqlite-db-path /tmp/presage.db.sqlite retrieve-profile

SIGNAL_ACCOUNT=`$PRESAGE_PRE whoami`

if [ "$SIGNAL_ACCOUNT" != "" ]; then
    echo "You already seem to have an account set up"
    echo $SIGNAL_ACCOUNT
    echo "If you want to set up again, delete $PRESAGE_DB"
else
    # Proceed with registration!
    echo Go to https://signalcaptchas.org/registration/generate and follow the instructions to generate a signal captcha code.
    echo Once you have solved the captcha, don\'t open Signal. Right click on the "Open Signal" link and copy the link.
    read -p "Then paste the signal captcha code here and press enter:" SIGNAL_CAPTCHA
    
    echo "Go to twilio messages https://console.twilio.com/us1/monitor/logs/sms to find the confirmation code for the next step"
    $PRESAGE_PRE register --servers production --phone-number $PHONE_NUMBER --captcha $SIGNAL_CAPTCHA
    # Then have to monitor the SMS messages, and type in the confirmation code.
fi

echo Now invite this number -- $PHONE_NUMBER -- to your group, and then send a message, so that we have a message to receive. You can safely re-run this script.

# Now have to receive message *from the group* before we get the group key.
$PRESAGE_PRE sync --stop-after-empty-queue

# Then we can list the groups
GROUP_KEY=`$PRESAGE_PRE list-groups | awk '{ print $1 }'`

echo
echo GROUP_KEY $GROUP_KEY
echo

set_env_var "GROUP_KEY" $GROUP_KEY $ENV_FILE

GROUP_KEY=b877c0fd2bf514c5ce5d9b49842a23405f6017242409d074260e4c062b6393aa

# Now we can send our first message!
$PRESAGE_PRE send-to-group --master-key $GROUP_KEY --message "Test message"
