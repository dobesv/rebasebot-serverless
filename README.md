
This project allows you to rebase a pull request on master without pulling it down to a local repo.  The bot
does it for you instead.

## Setup

1. Typically you will want to setup a special purpose github account for this purpose.  This user should have push access
   to all the repos you want to use this bot on.

2. Copy secrets-template.yml to secrets.yml and fill in the blanks

## Deployment

`serverless deploy`

## Connect to repo

Add the webhook URL displayed by serverless as a webhook to your repository.  Make sure the secret matches and
you choose events for "pull requests".


## Watch logs

`serverless logs -f rebasebot -t`

