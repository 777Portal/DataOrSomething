var waitUntil = require('wait-until');
const mineflayer = require('mineflayer')

const express = require('express') 
const app = express(); 

const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path');

const fs = require('fs');
const { getPackedSettings } = require('http2');

const options = {
    host: 'connect.constantiam.net',
    email: "OrangeInsanity@outlook.com", // Hyzz account
    auth: 'microsoft'
};

// haven't tested this much with higher volumes of data so idk how poor the actual prefomace is, but yk 'buyer' beware.
// assuming it would be better to transfer this to a db but yk im lazy.

//
//   saving / reading data part.
//

let playerData = {};

// Read the saved player data from the JSON file when the file runs
fs.readFile(options.host.toLowerCase()+'.json', (err, data) => {
    if (err) return console.error('Error reading friended players:', err);

    // if no error parse data and set the data to that data we got.
    playerData = JSON.parse(data);
    console.log(playerData)
    console.log(`Saved player data loaded successfully. \n ${Object.keys(playerData).length}`);
});


// self explaintory; saves the data to the files
function savePlayerData() {
    fs.writeFile(options.host+'.json', JSON.stringify(playerData), { encoding: 'utf8', flag: 'w' }, (err) => {
        // if err console log
        if (err) return console.error('!!! \n !!! \n !!! Error saving players:', err);
    });
}

//
//  mineflayer bot stuff.
//

var bot = mineflayer.createBot(options);
bindEvents(bot);

function bindEvents(bot) { 
    bot.once('spawn', () => {
        setInterval(function() { updatePlayerData(); }, 2500); // updates player data
        console.log('Spawned')
    })

    // on message (might use this later)
    bot.on('message', function(raw) {
        raw = raw.toString();
        io.emit( 'chatMsg' , raw )
        // console.log(raw)
    })


    // irrrc constatium uses vanilla chat so this should be fine...
    bot.on('chat', (username, message) => { // update to maybe store messages?
        // console.log(`${username} said "${message}"`)
    })
      
    bot.on('kicked', function(reason) {
        console.log(reason)
    })

    // to reconnect (this is fucking UGLY) 
    bot.on('end', function(reason) {
        waitUntil(10000, 9999, function condition() {
            try 
            {
              console.log("Bot ended , attempting to reconnect...", reason);
              bot = mineflayer.createBot(options);
              bindEvents(bot);
              return true;
            } 
            catch (error) 
            {
              console.log("Error: " + error);
              return false;
            }
        
            // Callback function that is only executed when condition is true or time allotted has elapsed
        }, function done(result) {
            console.log("Connection attempt result was: " + result);
            // sometimes flags it as true when it was obv not, but tbh it works so.
        });
    });

    function updatePlayerData(){
        players = bot.players;

        for ( var key in players ) 
        {
          if ( key.startsWith("§") || key.startsWith('CIT-') ) continue // is bot

          player = players[key]
          uuid = player.uuid
          playerInfo = playerData[uuid]

          let uuidExist = playerData.hasOwnProperty(uuid);

          if ( uuidExist ) 
          {
            // update the last / now seen (not new)
            playerInfo.lastSeen = new Date

            playerInfo.uuid = uuid
            
            // Adds times seen. theorically could get ROUGH estimate of playtime w/ this.
            playerInfo.timeSeen += 1
            
            playerUsernames = playerInfo.usernames

            // if username isn't in username array
            if ( !playerUsernames.includes(player.username) ) 
            {
                // adds it to the username list
                playerUsernames.push(player.username)
                console.log(`${player.username} is a new username for ${uuid}`)
            }

            if ( player.ping !== 0 ) // if it's zero, then its prob still figuring out the ping. 
            {
                playerInfo.lastPing = player.ping
            };
          }
          else
          {
            // add it to the list because its new
            playerData[uuid] = { "lastSeen": new Date, "firstSeen": new Date, "timeSeen": 0, "lastPing": "Unknown", "usernames": [player.username], "lastServerSeenOn": options.host, uuid};
            console.log(player.username, ' is new!')
          }
        } // end of for loop.
        savePlayerData();
    } // end of updatePlayerData()
} // end of bind bot

//
// socket stuffz
//

io.on('connection', function(socket) {
    // if( playerData.length > 0 ) playerData.forEach( ( element ) => io.emit( 'player' , element ) ); // sends friend list of each

    // sends bot message to server
    socket.on("sendChat", (arg) => {
        bot.chat(arg)
    });
})

// im thinking of moving the webserver files to another file because.. yes. also, i want to be able to acess the different servers from the same place.

// localhost:8080/*
app.get('/', function(req, res) {
    const filePath = path.join(__dirname, 'info.html');
    res.sendFile(filePath);
});

// api stuffz

// considering just putting this in the client and making them do the calculations.
function sortArray(value, method , host)
{
    // currently goes from lowest to highests
    var value1 = -1,
        value2 = 1

    method = method ?? 1 // defaults to lowest to higest.

    // this switches it to reverse, high to low.
    if (method == -1)
    {
        value1 = 1
        value2 = -1
    } 

    return Object.values(playerData).sort(function(a,b){
        if(a[value] == b[value]) // if value is same its in the same place
            return 0;

        if(a[value] < b[value]) // if value is less then ... it.
            return value1;

        if(a[value] > b[value]) // if value is more then ... it.
            return value2;
    });
}

app.get('/sortByField', function(req, res) {
    const field = req.query.field; // Get the field from query parameter
    const sortOrder = parseInt(req.query.order) || 1; // Get the sort order, default to ascending (1) if not provided

    if (field) 
    {
        res.send(sortArray(field, sortOrder));
    } 
    else 
    {
        res.status(400).send('No field given.');
    }
});

// sortByField?field=lastPing&order=-1 for highest.
// sortByField?field=lastPing&order=1 for lowest

// sortByField?field=lastSeen&order=1 for lowest (most recent at the bottoms)
// sortByField?field=lastSeen&order=-1 for highest (most recent at the top)

app.get('/raw', function (req, res) {
    res.send( playerData )
})

server.listen(8080); 
console.log("started on 8080")