"use strict";

require("dotenv").config();

var bot = require('./bot');
require('./web')(bot);
