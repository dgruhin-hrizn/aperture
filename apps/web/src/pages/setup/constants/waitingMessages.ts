/**
 * Amusing messages to cycle through while waiting for long-running jobs.
 * Includes adapted movie quotes and pop culture references.
 */
export const WAITING_MESSAGES = [
  // General amusing messages
  'Now might be a good time to grab some popcorn and put on a movie! 🍿',
  'Still here? The AI is working hard, we promise! 🤖',
  "Seriously? You're still watching the progress bar? 👀",
  'Pro tip: This is a great time to refill your coffee ☕',
  'The robots are analyzing your exquisite taste in media... 🎬',
  'Our AI is binge-watching your library metadata right now 📺',
  'You know what pairs well with waiting? Snacks. Go get some snacks. 🍕',
  'The AI is judging your movie collection... in the nicest way possible 🎭',
  'The embeddings are embedding. The syncs are syncing. All is well. ✨',
  "If you stare at the progress bar, it doesn't go faster. We checked. 📊",
  'Fun fact: You could watch an entire episode of something by now 📺',
  'The algorithm is doing algorithmy things. Very technical. Much compute. 💻',

  // The Big Lebowski
  '"The metadata really ties the whole collection together, man." – The Dude 🎳',
  '"Yeah, well, that\'s just like, your watch history, man." – The Dude 🎳',

  // Casablanca
  '"Here\'s looking at you, progress bar." – Rick Blaine 🥃',
  '"Of all the media servers in all the world, you walked into mine." – Rick 🥃',

  // A Few Good Men
  '"You can\'t handle the embeddings!" – Colonel Jessup ⚖️',

  // Terminator
  '"I\'ll be back... when the sync is done." – The Terminator 🤖',
  '"Come with me if you want to stream." – The Terminator 🤖',

  // Forrest Gump
  '"Life is like a box of recommendations. You never know what you\'re gonna get." – Forrest 🍫',
  '"Mama always said, syncing is as syncing does." – Forrest Gump 🍫',

  // Star Wars
  '"May the embeddings be with you." – Obi-Wan Kenobi ⚔️',
  '"I find your lack of patience disturbing." – Darth Vader 🌑',
  '"Do or do not sync. There is no try." – Yoda 🐸',
  '"These aren\'t the movies you\'re looking for." ...or are they? – Obi-Wan ⚔️',
  '"It\'s a sync!" – Admiral Ackbar 🦑',

  // E.T.
  '"E.T. phone home... to check on the sync progress." – E.T. 👽',

  // Jaws
  '"You\'re gonna need a bigger library." – Chief Brody 🦈',

  // The Sixth Sense
  '"I see watched movies." – Cole Sear 👻',

  // Toy Story
  '"To infinity and beyond!" ...is how long this might take for big libraries. – Buzz 🚀',
  '"You\'re my favorite recommendation." – Woody 🤠',

  // The Dark Knight
  '"Why so serious? It\'s just a progress bar." – The Joker 🃏',
  '"You either die a viewer, or live long enough to see yourself become a binge-watcher." 🦇',

  // Titanic
  '"I\'m the king of the metadata!" – Jack Dawson 🚢',
  '"Draw me like one of your French films." – Rose 🖼️',

  // The Godfather
  '"Keep your friends close, but your watch history closer." – Michael Corleone 🎩',
  '"I\'m gonna make him a recommendation he can\'t refuse." – Don Corleone 🎩',
  '"Leave the gun. Take the cannoli... and finish syncing." – Clemenza 🥮',

  // Wizard of Oz
  '"There\'s no place like a fully synced library." – Dorothy 🌈',
  '"Toto, I have a feeling we\'re not in Kansas anymore." We\'re in the cloud! ☁️',

  // Gone with the Wind
  '"Frankly my dear, I don\'t give a damn... how long this takes." – Rhett Butler 💨',
  '"After all, tomorrow is another sync job." – Scarlett O\'Hara 👗',

  // Jerry Maguire
  '"You had me at \'Start Initialization\'." – Jerry Maguire 💕',
  '"Show me the recommendations!" – Rod Tidwell 🏈',

  // Top Gun
  '"I feel the need... the need for speed!" Same, progress bar. Same. – Maverick ✈️',
  '"Talk to me, Goose." About when this sync will finish. ✈️',

  // Finding Nemo
  '"Just keep syncing, just keep syncing..." – Dory 🐟',
  '"Fish are friends, not food. Metadata is life." – Bruce 🦈',

  // Frankenstein
  '"It\'s alive! IT\'S ALIVE!" ...the sync job, we mean. – Dr. Frankenstein ⚡',

  // Apollo 13
  '"Houston, we have a sync job." – Jim Lovell 🚀',

  // The Princess Bride
  '"As you wish." – Wesley, probably to a sync request 👸',
  '"Hello. My name is Inigo Montoya. You synced my library. Prepare to wait." ⚔️',
  '"Inconceivable!" ...that you\'re still watching this progress bar. 🤴',

  // Gladiator
  '"Are you not entertained?!" – Maximus, watching the progress bar 🗡️',

  // The Shining
  '"Here\'s Johnny!" ...and your freshly synced recommendations! 🪓',
  '"All work and no play makes sync a dull job." – Jack Torrance ❄️',

  // Ghostbusters
  '"Who you gonna call? ...when the sync is done!" – Ghostbusters 👻',
  '"I ain\'t afraid of no sync." – Ghostbusters 👻',

  // Back to the Future
  '"Where we\'re going, we don\'t need buffering." – Doc Brown ⚡',
  '"Great Scott! The sync is still running!" – Doc Brown 🚗',

  // The Matrix
  '"There is no spoon. There is only metadata." – Spoon Boy 🥄',
  '"I know kung fu." Cool, but do you know when this sync ends? – Neo 🕶️',
  '"What if I told you... the progress bar is almost done?" – Morpheus 🕶️',

  // Jurassic Park
  '"Life, uh, finds a way." So do sync jobs. Eventually. – Ian Malcolm 🦖',
  '"Hold on to your butts." – Ray Arnold 🦕',

  // Lord of the Rings
  '"One does not simply walk into a completed sync." – Boromir 🧙',
  '"My precious... metadata." – Gollum 💍',
  '"You shall not pass!" ...until the sync is done. – Gandalf 🧙',

  // Harry Potter
  '"It\'s leviOsa, not levioSA." Also, it\'s syncing, not synced. – Hermione 🪄',
  '"After all this time?" "Always." – Snape, about watching progress bars 🐍',

  // Anchorman
  '"I\'m kind of a big deal." – This sync job, probably 📰',
  '"60% of the time, it works every time." – Brian Fantana 📰',

  // The Hangover
  '"What happens in Vegas stays in Vegas. What syncs in Aperture, stays synced." 🎰',

  // Ferris Bueller's Day Off
  '"Life moves pretty fast. If you don\'t stop and sync once in a while, you could miss it." 🚗',

  // Mean Girls
  '"On Wednesdays, we sync pink... movies?" – Karen 💅',
  '"Stop trying to make manual syncing happen. It\'s not going to happen." – Gretchen 💅',

  // Napoleon Dynamite
  '"This sync is like the best sync I\'ve ever synced." – Napoleon 🦙',

  // Monty Python
  '"It\'s just a flesh wound!" – The Black Knight, about sync errors 🗡️',
  '"We are the knights who say... \'Sync!\'" – The Knights 🏰',
  '"Nobody expects the Spanish Inquisition!" Or how long syncs take. 🔴',

  // Office Space
  '"I believe you have my metadata." – Milton 🔴',
  '"Yeah, if you could just go ahead and finish syncing, that\'d be great." – Lumbergh ☕',

  // Airplane!
  '"I am serious. And don\'t call me Shirley." – Leslie Nielsen ✈️',
  '"Looks like I picked the wrong week to quit watching progress bars." ✈️',

  // Die Hard
  '"Yippee-ki-yay, media server!" – John McClane 🏢',
  '"Now I have a synced library. Ho ho ho." – John McClane 🎄',

  // Caddyshack
  '"So I got that goin\' for me, which is nice." – Carl Spackler ⛳',

  // Animal House
  '"Toga! Toga! Sync! Sync!" – Bluto 🎓',

  // Pulp Fiction
  '"Say \'sync\' again. I dare you." – Jules Winnfield 💼',
  '"That\'s a pretty good milkshake." Also, this is a pretty good sync job. 🥤',

  // Shawshank Redemption
  '"Get busy syncing, or get busy dying." – Andy Dufresne 🔨',
  '"Hope is a good thing, maybe the best of things. And no sync dies forever." 🕊️',

  // Fight Club
  '"The first rule of Sync Club is: you do not talk about how long syncs take." 🥊',

  // A Christmas Story
  '"You\'ll shoot your eye out!" But first, let the sync finish. 🎄',

  // Elf
  '"The best way to spread Christmas cheer is syncing loud for all to hear." – Buddy 🧝',

  // Home Alone
  '"Keep the change, ya filthy animal." – Gangster Movie 🏠',

  // Wayne's World
  '"Excellent!" – Wayne & Garth, when the sync finishes 🎸',
  '"Party on, Wayne!" "Party on, Garth!" "Party on, sync job!" 🤘',

  // Rocky
  '"Yo, Adrian! The sync is almost done!" – Rocky Balboa 🥊',
  '"It ain\'t about how hard you sync. It\'s about how hard you can get synced and keep moving forward." – Rocky 🥊',
  '"I\'m gonna sync you up!" – Rocky 🥊',

  // Scarface
  '"Say hello to my little sync!" – Tony Montana 🔫',
  '"First you get the metadata, then you get the recommendations, then you get the power." – Tony Montana 💰',

  // Dirty Harry
  '"Go ahead, make my sync." – Harry Callahan 🔫',
  '"You\'ve got to ask yourself one question: Do I feel lucky? Well, do ya, sync?" – Harry 🔫',

  // Cool Hand Luke
  '"What we\'ve got here is failure to sync." – Captain 🥚',

  // Taxi Driver
  '"You syncing\' to me?" – Travis Bickle 🚕',

  // Field of Dreams
  '"If you build it, they will sync." – The Voice 🌽',

  // Network
  '"I\'m as mad as hell, and I\'m not going to take this... wait, the sync finished? Never mind!" 📺',

  // The Breakfast Club
  '"Don\'t you forget about sync." – Simple Minds 🎵',
  '"We\'re all pretty bizarre. Some of us just sync better at hiding it." 🏫',

  // Dirty Dancing
  '"Nobody puts Baby in a sync queue." – Johnny Castle 💃',
  '"I carried a watermelon." I watched a progress bar. Same energy. 🍉',

  // When Harry Met Sally
  '"I\'ll have what she\'s syncing." – Customer 🍽️',

  // Braveheart
  '"They may take our time, but they\'ll never take our metadata!" – William Wallace 🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  '"FREEDOM! ...to browse a synced library." – William Wallace ⚔️',

  // The Silence of the Lambs
  '"Hello, Clarice. I\'ve been syncing your data." – Hannibal Lecter 🦋',
  '"I ate his metadata with some fava beans and a nice Chianti." – Hannibal 🍷',

  // Goodfellas
  '"As far back as I can remember, I always wanted to be a synced library." – Henry Hill 🎰',
  '"Funny how? Funny like a clown? Am I here to amuse you while you sync?" – Tommy 🤡',

  // Scarface (more)
  '"In this country, you gotta sync the metadata first." – Tony Montana 🌴',

  // The Usual Suspects
  '"The greatest trick the devil ever pulled was convincing the world the sync was instant." – Verbal Kint 😈',

  // Se7en
  '"What\'s in the box?! ...Is it synced data?" – Detective Mills 📦',

  // American Beauty
  '"I\'m just an ordinary sync... with nothing to lose." 🌹',

  // Citizen Kane
  '"Rosebud..." was the name of his favorite synced movie. 🛷',

  // Blade Runner
  '"I\'ve seen things you people wouldn\'t believe. Syncs taking off on fire in the cloud." – Roy Batty 🤖',
  '"All those moments will be lost in time, like tears in rain. Unless you sync them." 🌧️',

  // 2001: A Space Odyssey
  "\"I'm sorry, Dave. I'm afraid I can't speed up this sync.\" – HAL 9000 🔴",
  '"Open the sync bay doors, HAL." 🚀',

  // Alien
  '"In space, no one can hear you sync." 👽',
  '"Get away from her, you sync!" – Ripley 👽',

  // Aliens
  '"Game over, man! Game over!" ...Wait, the sync isn\'t done yet. – Hudson 🎮',

  // Predator
  '"Get to the synced library!" – Dutch 🚁',
  '"If it syncs, we can watch it." – Billy 🏹',

  // Robocop
  '"Dead or alive, you\'re syncing with me." – Robocop 🤖',

  // Total Recall
  '"Get your ass to sync!" – Quaid 🔴',
  '"Consider that a sync." – Quaid 💪',

  // The Truman Show
  '"Good morning, and in case I don\'t see ya: good afternoon, good evening, and good sync!" – Truman 📺',

  // Groundhog Day
  '"I got you babe..." and a sync that feels like it\'s repeating. – Phil Connors ⏰',

  // Beetlejuice
  '"Sync, sync, sync!" – Everyone trying to summon a faster sync 👻',

  // Edward Scissorhands
  '"I can\'t sync. Because I have scissors... for hands." ✂️',

  // The Iron Giant
  '"I am not a gun. I am a sync." – Iron Giant 🤖',

  // Who Framed Roger Rabbit
  '"I\'m not bad, I\'m just synced that way." – Jessica Rabbit 🐰',

  // Willy Wonka
  '"We are the music makers, and we are the dreamers of syncs." – Willy Wonka 🍫',
  '"Come with me and you\'ll be in a world of pure synchronization." – Willy Wonka 🎩',

  // Grease
  '"Tell me more, tell me more, did the sync take long?" 🎤',
  '"You\'re the sync that I want!" – Danny & Sandy 💕',

  // The Sound of Music
  '"The hills are alive with the sound of syncing." – Maria 🎵',
  '"How do you solve a problem like a slow sync?" 🌄',

  // Mary Poppins
  '"Supercalifragilisticexpialidocious! The sync is almost done!" ☂️',
  '"A spoonful of metadata helps the sync job go down." – Mary Poppins 🥄',

  // Singin\' in the Rain
  '"I\'m syncing in the rain, just syncing in the rain!" ☔',

  // West Side Story
  '"When you\'re a Sync, you\'re a Sync all the way." 🎭',

  // Some Like It Hot
  '"Nobody\'s perfect." Especially not sync times. 🎷',

  // The Apartment
  '"Shut up and sync." 🏢',

  // Chinatown
  '"Forget it, Jake. It\'s just a sync job." 🕵️',

  // Sunset Boulevard
  '"All right, Mr. DeMille, I\'m ready for my sync." – Norma Desmond 🎬',
  '"I am big. It\'s the sync jobs that got small." 🌅',

  // Psycho
  '"A boy\'s best friend is his synced library." – Norman Bates 🚿',

  // Vertigo
  '"I look up, I look down... at the progress bar." – Scottie 🌀',

  // North by Northwest
  '"I\'m an innocent man being chased by a sync job!" – Roger Thornhill 🌽',

  // Rear Window
  "\"I've been watching my neighbor's sync progress. It's fascinating.\" – Jeff 📷",

  // The Birds
  '"Why are they syncing?!" – Melanie 🐦',

  // Dr. Strangelove
  '"Gentlemen, you can\'t fight in here! This is the Sync Room!" 💣',

  // Apocalypse Now
  '"I love the smell of synced data in the morning." – Kilgore 🚁',
  '"The horror... the horror..." of watching progress bars. – Kurtz 🌿',

  // Full Metal Jacket
  '"This is my sync. There are many like it, but this one is mine." 🎖️',

  // Platoon
  '"I think now, looking back, we did not sync the village. We synced ourselves." 🌴',

  // The Deer Hunter
  '"One sync!" – Michael 🦌',

  // Raging Bull
  '"You sync me? You sync me?" – Jake LaMotta 🥊',

  // Taxi Driver (more)
  '"Someday a real sync will come and wash all this buffering off the streets." – Travis 🚕',

  // The Departed
  '"I\'m the guy who does his sync. You must be the other guy." – Billy Costigan 🕵️',

  // No Country for Old Men
  '"What\'s the most you ever synced on a coin toss?" – Anton Chigurh 💰',

  // There Will Be Blood
  '"I drink your milkshake! I drink it up!" While waiting for sync to finish. 🥤',
  '"I\'m an oil man. I\'m also a sync man." – Daniel Plainview 🛢️',

  // The Social Network
  '"A million syncs isn\'t cool. You know what\'s cool? A billion syncs." – Sean Parker 💻',
  '"You know what\'s cooler than a million recommendations? A billion recommendations." 👍',

  // Inception
  '"We need to sync deeper." – Cobb 🌀',
  '"You mustn\'t be afraid to sync a little bigger, darling." – Eames 🎭',
  '"Is your sync still spinning?" – Cobb 🎡',

  // Interstellar
  '"Don\'t let me leave, Murph!" Don\'t let the sync fail! 🌌',
  '"Love is the one thing that transcends time and space. And sync jobs." 🕳️',
  '"Those aren\'t mountains. They\'re progress bars." ⛰️',

  // The Revenant
  '"I ain\'t afraid to die anymore. I\'ve done it already. Waiting for syncs." – Glass 🐻',

  // Mad Max: Fury Road
  '"Oh what a day! What a lovely sync!" – Nux 🔥',
  '"Witness me!" – Nux, starting a sync 🏎️',
  '"We are not things! We are syncs!" – The Wives 🌊',

  // Django Unchained
  '"The D is silent... like the progress bar. Until it moves." – Django 🐴',
  '"I like the way you sync, boy." – Dr. Schultz 🎩',

  // Inglourious Basterds
  '"That\'s a bingo! The sync is done!" – Hans Landa 🎯',
  '"You just say bingo. And also, sync complete." 🎰',

  // Kill Bill
  '"Silly rabbit, syncs are for kids." – The Bride 🐰',
  '"Wiggle your big toe." And watch the sync bar. 🦶',

  // Reservoir Dogs
  '"Are you gonna bark all day, little doggy, or are you gonna sync?" – Mr. Blonde 🐕',

  // The Hateful Eight
  '"The thing about waiting for a sync is... you wait, and you hate it." ❄️',

  // Once Upon a Time in Hollywood
  '"It\'s official. Old Yeller is a synced library." 🎬',

  // Joker
  '"All I have are negative sync times." – Arthur 🤡',
  '"You get what you syncing deserve!" – Joker 🤡',

  // Black Panther
  '"Wakanda Forever!" And synced forever! 🐾',
  '"I never freeze. Unlike this sync job." – T\'Challa ❄️',

  // Avengers: Endgame
  '"I am... inevitable." So is this sync completing. – Thanos 💎',
  '"And I... am... synced." – Tony Stark 🦾',
  '"Whatever it takes." To finish this sync. 🛡️',
  '"I can do this all day." Watch progress bars, that is. – Captain America 🛡️',

  // Avengers: Infinity War
  '"Perfectly balanced, as all syncs should be." – Thanos ⚖️',
  '"Mr. Stark, I don\'t feel so good..." about how long this sync is taking. 🕷️',

  // Thor: Ragnarok
  '"That\'s what heroes do. They sync." – Thor ⚡',
  '"I have been falling... for 30 minutes!" Like this sync job. – Loki 🐍',

  // Guardians of the Galaxy
  '"I am Groot." (Translation: Is the sync done yet?) 🌳',
  '"We are Groot." (Translation: We are synced.) 🌳',
  '"Come and get your sync!" – Star-Lord 🎧',

  // Spider-Man
  '"With great sync comes great responsibility." – Uncle Ben 🕷️',
  '"Pizza time!" ...while we wait for the sync. – Peter Parker 🍕',

  // Iron Man
  '"I am Iron Man." And this sync is ironing out the details. 🦾',
  '"Sometimes you gotta run before you can sync." – Tony Stark 🤖',

  // Captain America: The First Avenger
  '"I could do this all day." Watch syncs, I mean. – Steve Rogers 🛡️',
  '"Not a perfect soldier, but a perfect sync." 🇺🇸',

  // Doctor Strange
  '"Dormammu, I\'ve come to bargain... for a faster sync." – Dr. Strange 🌀',
  '"It\'s not about you. It\'s about the sync." – The Ancient One ⏰',

  // Wonder Woman
  '"I am Diana of Themyscira, and my sync is almost done!" – Diana 🦸',
  '"I believe in sync. Don\'t you?" – Diana 💪',

  // The Dark Knight Rises
  '"When the sync is complete, you have my permission to die... of happiness." – Bane 😷',
  '"You merely adopted the sync. I was born in it, molded by it." – Bane 🦇',

  // Batman Begins
  '"It\'s not who I am underneath, but the syncs I run that define me." – Batman 🦇',
  '"Why do we sync? So we can learn to pick ourselves up when recommendations fail." 🦇',

  // Superman
  '"You\'ll believe a sync can fly." 🦸',
  "\"Look! Up in the sky! It's a bird! It's a plane! It's a sync job!\" 🦸",

  // X-Men
  '"Mutation: it is the key to our sync-olution." – Professor X 🧬',

  // Deadpool
  '"Maximum effort!" – Deadpool, starting a sync 💀',
  '"I\'m touching myself tonight... after this sync finishes." – Deadpool 😏',

  // Logan
  '"So this is what it feels like." When a sync finally completes. – Logan 🐺',

  // The Hunger Games
  '"May the odds be ever in your sync\'s favor." – Effie Trinket 🏹',
  '"I volunteer as sync tribute!" – Katniss 🔥',

  // Twilight
  '"And so the sync, fell in love with the progress bar." 🧛',
  '"You\'re like my own personal brand of sync." – Edward 🌙',

  // Pirates of the Caribbean
  '"But you have heard of sync." – Captain Jack Sparrow 🏴‍☠️',
  '"Why is the sync gone?!" – Jack Sparrow 🍾',
  '"This is the day you will always remember as the day you almost synced Captain Jack Sparrow!" 🏴‍☠️',

  // Shrek
  '"Syncs are like onions. They have layers." – Shrek 🧅',
  '"What are you doing in my sync?!" – Shrek 🏠',

  // The Incredibles
  '"Where is my super sync?!" – Frozone 🧊',
  '"No capes! Also, no slow syncs." – Edna Mode ✂️',

  // Up
  '"Adventure is out there!" After this sync finishes. 🎈',
  '"I was hiding under your progress bar because I love you." – Dug 🐕',

  // Inside Out
  '"Take her to the sync!" – Joy 🌈',
  '"I\'m positive you will get through this sync!" – Joy 😊',

  // Coco
  '"Remember me, when the sync is done." 🎸',
  '"Seize your sync!" – Ernesto de la Cruz 🎺',

  // Moana
  '"I am Moana of Motunui. You will sync my data!" 🌊',
  '"What can I sync, except you\'re welcome!" – Maui 🪝',

  // Frozen
  '"Let it sync, let it sync!" – Elsa ❄️',
  '"Do you want to build a sync job?" – Anna ⛄',
  '"Some syncs are worth waiting for." – Olaf ⛄',

  // Tangled
  '"I have a sync, I have a sync, I have a sync!" – Rapunzel 🏰',

  // The Lion King
  '"Hakuna Matata! It means no worries about slow syncs!" 🦁',
  '"Remember who you are. You are my sync." – Mufasa 🌅',
  '"Long live the sync!" – Scar 🦁',

  // Aladdin
  '"A whole new sync! A new fantastic point of view!" 🧞',
  '"Genie, I wish for a faster sync!" – Aladdin 🪔',

  // Beauty and the Beast
  '"Tale as old as time... waiting for syncs." 🌹',
  '"Be our guest! Be our guest! While the sync does the rest!" 🕯️',

  // The Little Mermaid
  '"I want to be where the synced files are." – Ariel 🧜',
  '"Look at this sync, isn\'t it neat?" 🐚',

  // Mulan
  '"Let\'s get down to business, to defeat... the slow sync!" ⚔️',
  '"The flower that blooms in adversity is the most beautiful sync of all." 🌸',

  // Pocahontas
  '"Can you paint with all the colors of the sync?" 🍂',
  '"Just around the riverbend is a completed sync!" 🛶',

  // Hercules
  '"I can go the distance! ...waiting for this sync." – Hercules 💪',
  '"Zero to sync in no time flat!" ⚡',

  // Lilo & Stitch
  '"Ohana means family. Family means no sync left behind." 🌺',
  '"Also cute and fluffy!" – Stitch, about synced data 👽',

  // Monsters, Inc.
  '"Put that sync back where it came from, or so help me!" – Mike 👁️',
  '"Kitty!" ...I mean, sync complete! – Boo 👧',

  // Ratatouille
  '"Anyone can sync." – Gusteau 👨‍🍳',
  '"Not everyone can become a great sync, but a great sync can come from anywhere." – Ego 🐀',

  // WALL-E
  '"Directive: Sync." – WALL-E 🤖',
  '"WALL-E..." "EVE-A!" "SYNC!" 💚',

  // Brave
  '"If you had the chance to change your sync, would you?" – Merida 🏹',

  // Zootopia
  '"Anyone can be anything! Even a completed sync!" – Judy Hopps 🐰',
  '"It\'s called a hustle, sweetheart. Also, a sync." – Nick Wilde 🦊',

  // Wreck-It Ralph
  '"I\'m gonna wreck it!" After the sync finishes. – Ralph 👊',
  "\"I'm bad, and that's good. I will never be slow, and that's not bad.\" – Vanellope about syncs 🍬",

  // Big Hero 6
  '"I am satisfied with my sync." – Baymax 🤖',
  '"On a scale of 1 to 10, how would you rate your sync progress?" – Baymax 📊',

  // Encanto
  '"We don\'t talk about sync-o, no, no, no!" 🌺',
  '"Surface pressure..." of waiting for syncs. 💎',

  // Soul
  '"Is all this living really worth syncing?" – Joe Gardner 🎹',

  // Turning Red
  '"My sync, my choice!" – Mei 🔴',

  // Lightyear
  '"To infinity... and a completed sync!" – Buzz 🚀',

  // Avatar
  '"I see you." Waiting for the sync. – Neytiri 🌿',
  '"This is your sync now." – Jake Sully 🌍',

  // Dune
  '"The sync must flow." – Paul Atreides 🏜️',
  '"Fear is the mind-killer. Slow syncs are the patience-killer." 🐛',

  // The Notebook
  '"If you\'re a sync, I\'m a sync." – Noah 💌',
  '"It wasn\'t over. It still isn\'t over. The sync, I mean." 🌧️',

  // Titanic (more)
  '"I\'ll never let go, sync!" – Rose 🚢',
  '"There\'s enough room on this door for me and the sync progress!" 🚪',

  // La La Land
  '"Here\'s to the ones who sync." 🌟',
  '"City of syncs, are you just syncing for me?" 🎹',

  // A Star Is Born
  '"I just wanted to take another look at you... and the sync progress." 🌟',

  // Bohemian Rhapsody
  '"Is this the real sync? Is this just fantasy?" 🎤',
  '"I want it all! I want it all! I want it all! ...synced, that is." 👑',

  // Rocketman
  '"I\'m still syncing!" – Elton 🚀',

  // The Greatest Showman
  '"This is the greatest sync!" 🎪',
  '"A million dreams for the sync we\'re gonna make." ✨',
]
