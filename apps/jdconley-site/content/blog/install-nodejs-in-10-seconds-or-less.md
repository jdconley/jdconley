---
title: Install node.js in 10 Seconds or Less
date: 2011-08-01T15:00:00.000-07:00
slug: install-nodejs-in-10-seconds-or-less
description: I've been playing around a bit with node recently. One thing it's quite good at is quickly bringing up a developer workstation. You can just run a quick command line to have…
tags:
  - node
draft: false
updated: 2011-08-01T15:05:25.053-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-4679098985155157274
originalUrl: http://blog.jdconley.com/2011/08/install-nodejs-in-10-seconds-or-less.html
ogImage: /blog-assets/og/install-nodejs-in-10-seconds-or-less-v1.jpg
ogImageAlt: "NODE.JS IN SECONDS. A green stopwatch and a fast-moving Node.js emblem. — JD Conley."
---

I've been playing around a bit with [node](http://nodejs.org/) recently. One thing it's quite good at is quickly bringing up a developer workstation. You can just run a quick command line to have the server running rather than futzing with config files, virtual directories, software installations, and such. When your team uses different development platforms (Linux, Mac, Windows) or your development environment is different from production, a bit of scripting makes it much easier to insure everyone is on a level playing field.  
  
I found myself having to remember too many commands when setting up node for my application on two different OSX laptops. I wanted to be able to quickly get node up and running for a non-privileged user account and with node modules installed locally for the application. This is ideal when you're working with multiple projects that may use different versions of node or different versions of modules.  
  
The key ingredient is the great version management tool called [nvm](https://github.com/creationix/nvm) (Node Version Manager). It lets you easily download, compile, and associate a version of node with a particular terminal session. Combined with [npm](http://npmjs.org/) (Node Package Manager), making a setup script for an application is nice-n-easy. I whipped up this little script for a recent prototype project. Copy and modify as desired.  
  

```
#!/bin/sh

#A script to setup the node environment using nvm and npm.
#This is intended to be run on developer workstations. 

#Check for well known prereqs that might be missing
hash git 2>&- || { echo >&2 "I require 'git'."; exit 1; }
hash make 2>&- || { echo >&2 "I require 'make'."; exit 1; }
hash python 2>&- || { echo >&2 "I require 'python'."; exit 1; }

#Clean up old stuff.
rm -rf ~/.nvm
rm -rf node_modules

#Download, source, and update nvm's package list
git clone git://github.com/creationix/nvm.git ~/.nvm
. ~/.nvm/nvm.sh
nvm sync

#Install latest stable version of node
#Change 'stable' to a version number to install a specific node
#See `nvm help` for more info
nvm install stable
nvm use stable

#Install all the modules we desire
node_modules="mime qs hashlib connect ejs express hiredis policyfile redis uglify-js socket.io-client socket.io multi-node generic-pool"
for m in $node_modules;
  do npm install $m;
done;
```

  

1.  Copy and paste this script into an installnode.sh file
2.  chmod a+x installnode.sh
3.  ./installnode.sh

  
Make sure to run the script in the directory where you want the node\_modules to be installed. That's it! Happy node hacking.  
  
Also, this script is... destructive. If you don't want to download and rebuild node every time you might want to remove the \`rm -rf ~/.nvm\`.
