#!/usr/bin/env node

/* Dependencies */

var cli = require('cli')
  , path = require('path')
  , util = require('util')
  , backup = require('../')
  , cronJob = require('cron').CronJob
  , fs = require("fs")
  , path = require("path")
  , pkg = require('../package.json')
  , crontab = "0 0 * * *"
  , timezone = "America/New_York"
  , time = [0, 0]
  , options, configPath, config;

cli
  .enable('version')
  .setApp(pkg.name, pkg.version)
  .setUsage(cli.app + ' [OPTIONS] <path to json config>');

options = cli.parse({
  now:   ['n', 'Run sync on start']
});

if(cli.args.length !== 1) {
  //look for a config.json in the process dir
  configPath = path.join(process.cwd(), "config.json");
  fs.exists(configPath, function(exists){
    if(!exists){
      return cli.getUsage();
    }
  });

}

/* Configuration */

configPath = configPath || path.resolve(process.cwd(), cli.args[0]);
backup.log('Loading config file (' + configPath + ')');
config = require(configPath);

config.rethinkdb.host = (process.env.BACKUP_RETHINKDB_HOST || config.rethinkdb.host)
config.rethinkdb.port = (process.env.BACKUP_RETHINKDB_PORT || config.rethinkdb.port)
config.rethinkdb.db = (process.env.BACKUP_RETHINKDB_DB || config.rethinkdb.db)

config.s3.key = (process.env.BACKUP_S3_KEY || config.s3.key)
config.s3.secret = (process.env.BACKUP_S3_SECRET || config.s3.secret)
config.s3.bucket = (process.env.BACKUP_S3_BUCKET || config.s3.bucket)
config.s3.destination = (process.env.BACKUP_S3_DESTINATION || config.s3.destination)

config.cron.crontab = (process.env.BACKUP_CRON_CRONTAB || config.cron.crontab)

if(options.now) {
  backup.sync(config.rethinkdb, config.s3, function(err) {
    process.exit(err ? 1 : 0);
  });
} else {
  // If the user overrides the default cron behavior
  if(config.cron) {
    if(config.cron.crontab) {
      crontab = config.cron.crontab
    } else if(config.cron.time) {
      time = config.cron.time.split(':')
      crontab = util.format('%d %d * * *', time[0], time[1]);
    }

    if(config.cron.timezone) {
      try {
        require('time'); // Make sure the user has time installed
      } catch(e) {
        backup.log(e, "error");
        backup.log("Module 'time' is not installed by default, install it with `npm install time`", "error");
        process.exit(1);
      }

      timezone = config.cron.timezone;
      backup.log('Overriding default timezone with "' + timezone + '"');
    }
  }

  new cronJob(crontab, function(){
    backup.sync(config.rethinkdb, config.s3);
  }, null, true, timezone);
  backup.log('Rethink Nightly Backup Successfully scheduled (' + crontab + ')');
}
