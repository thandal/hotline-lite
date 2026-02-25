#!/bin/bash

echo This script will help you set up a new Signal account using the presage-cli.

PRESAGE_BIN="twilio-hotline/assets/presage-cli.private.bin"
PRESAGE_DB="/tmp/presage.db"

# HACK DEBUG
#PRESAGE_PASSPHRASE=`uuidgen`
PRESAGE_PASSPHRASE=a34e34f55-a10f-4b91-b666-f7ebd3d1b25c

echo Your presage database passphrase is 
echo $PRESAGE_PASSPHRASE
echo "PRESAGE_PASSPHRASE=\"$PRESAGE_PASSPHRASE\"" >> twilio-hotline/.env

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

SIGNAL_ACCOUNT=`$PRESAGE_BIN --sqlite-db-path $PRESAGE_DB --passphrase $PRESAGE_PASSPHRASE whoami`

if [ "$SIGNAL_ACCOUNT" != "" ]; then
    echo "You already seem to have an account set up"
    echo $SIGNAL_ACCOUNT
    echo "If you want to set up again, delete $PRESAGE_DB"
fi

exit

# Proceed with registration!
echo Go to https://signalcaptchas.org/registration/generate and follow the instructions to generate a signal captcha code.
echo Once you have solved the captcha, don\'t open Signal. Right click on the "Open Signal" link and copy the link.
read -p "Then paste the signal captcha code here and press enter:" SIGNAL_CAPTCHA

echo "Go to twilio messages https://console.twilio.com/us1/monitor/logs/sms to find the confirmation code for the next step"
./presage-cli --sqlite-db-path $PRESAGE_DB --passphrase $PRESAGE_PASSPHRASE register --servers production --phone-number $PHONE_NUMBER --captcha $SIGNAL_CAPTCHA
# Then have to monitor the SMS messages, and type in the confirmation code.

# TODO: Split apart the register and verify steps in presage-cli...


# First have to receive message *from the group* before we get the group key.
# You'll need to invite the account to the group and then send some message to the group.
./presage-cli --sqlite-db-path $PRESAGE_DB --passphrase $PRESAGE_PASSPHRASE receive

# Then we can list the groups
./presage-cli --sqlite-db-path $PRESAGE_DB --passphrase $PRESAGE_PASSPHRASE list-groups

# TODO: store the GROUP_KEY in twilio-hotline/.env
GROUP_KEY=b877c0fd2bf514c5ce5d9b49842a23405f6017242409d074260e4c062b6393aa

# Now we can send our first message!
./presage-cli --sqlite-db-path $PRESAGE_DB --passphrase $PRESAGE_PASSPHRASE send-to-group --master-key $GROUP_KEY --message "Test message 1"
