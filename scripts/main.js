require(["osu", "underscore", "skin", "sound", "playback"],
function(Osu, _, Skin, sound, Playback) {

    // initialize global game
    var game = {
        window: window,
        stage: null,
        scene: null,
        updatePlayerActions: null,

        // note: preference values here will be overwritten by gamesettings (in settings.js)
        backgroundDimRate: 0.7,
        backgroundBlurRate: 0.0, // not yet implemented
        allowMouseButton: false,
        allowMouseScroll: true,
        cursorSize: 1.0,

        masterVolume: 0.7,
        effectVolume: 1.0,
        musicVolume: 1.0,

        K1keycode: 90,
        K2keycode: 88,

        // cursor info
        mouseX: 0, // in absolute pixel
        mouseY: 0,
        K1down: false,
        K2down: false,
        M1down: false,
        M2down: false,
        down: false,

        lastFrameTime: -1,
        finished : false,
        score: {
          nbClicks: 0,
          goodClicks: 0,
          points: 0
        },
        sample: [{}, {}, {}, {}],
        sampleSet: 1
    };
    window.game = game;
    if (window.gamesettings)
        window.gamesettings.loadToGame();
    window.skinReady = false;
    window.soundReady = false;
    window.scriptReady = false;
    window.addEventListener("mousemove", function(e) {
        game.mouseX = e.clientX;
        game.mouseY = e.clientY;
    });
    game.stage = new PIXI.Container();
    game.cursor = null;


    // load skin & game cursor
    Skin.oncomplete = function() {
        window.skinReady = true;
        document.getElementById("skin-progress").innerText += " Done";
    };
    Skin.loadDefault();


    // load sounds
    // load hitsound set
    var sample = [
        'hitsounds/normal-hitnormal.mp3',
        'hitsounds/normal-hitwhistle.mp3',
        'hitsounds/normal-hitfinish.mp3',
        'hitsounds/normal-hitclap.mp3',
        'hitsounds/soft-hitnormal.mp3',
        'hitsounds/soft-hitwhistle.mp3',
        'hitsounds/soft-hitfinish.mp3',
        'hitsounds/soft-hitclap.mp3',
        'hitsounds/drum-hitnormal.mp3',
        'hitsounds/drum-hitwhistle.mp3',
        'hitsounds/drum-hitfinish.mp3',
        'hitsounds/drum-hitclap.mp3'
    ];
    console.log("Loading hit sounds:");
    console.log(sample);
    sounds.whenLoaded = function(){
        game.sample[1].hitnormal = sounds['hitsounds/normal-hitnormal.mp3'];
        game.sample[1].hitwhistle = sounds['hitsounds/normal-hitwhistle.mp3'];
        game.sample[1].hitfinish = sounds['hitsounds/normal-hitfinish.mp3'];
        game.sample[1].hitclap = sounds['hitsounds/normal-hitclap.mp3'];
        game.sample[2].hitnormal = sounds['hitsounds/soft-hitnormal.mp3'];
        game.sample[2].hitwhistle = sounds['hitsounds/soft-hitwhistle.mp3'];
        game.sample[2].hitfinish = sounds['hitsounds/soft-hitfinish.mp3'];
        game.sample[2].hitclap = sounds['hitsounds/soft-hitclap.mp3'];
        game.sample[3].hitnormal = sounds['hitsounds/drum-hitnormal.mp3'];
        game.sample[3].hitwhistle = sounds['hitsounds/drum-hitwhistle.mp3'];
        game.sample[3].hitfinish = sounds['hitsounds/drum-hitfinish.mp3'];
        game.sample[3].hitclap = sounds['hitsounds/drum-hitclap.mp3'];
        window.soundReady = true;
        document.getElementById("sound-progress").innerText += " Done";
    };
    sounds.load(sample);


    // load app
    let app = new PIXI.Application({
        width: window.innerWidth,
        height: window.innerHeight,
        resolution: window.devicePixelRatio || 1,
        autoResize: true,
    });
    app.renderer.autoResize = true;
    app.renderer.backgroundColor = 0xFFFFFF;

    // load audio context
    window.AudioContext = window.AudioContext || window.webkitAudioContext;


    // objects that contain osu object of a beatmap
    function BeatmapController(){
        this.osuReady = false;
    }
    BeatmapController.prototype.startGame = function(trackid) {
        // get ready for gaming
        // Hash.set(osu.tracks[0].metadata.BeatmapSetID);
        if (!scriptReady || !skinReady || !soundReady || !this.osuReady)
            return;
        document.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            return false;
        });
        // load cursor
        game.cursor = new PIXI.Sprite(Skin["cursor.png"]);
        game.cursor.anchor.x = game.cursor.anchor.y = 0.5;
        game.cursor.scale.x = game.cursor.scale.y = 0.6 * game.cursorSize;
        game.stage.addChild(game.cursor);
        // switch page to game view
        pGameArea.appendChild(app.view);
        pMainPage.setAttribute("hidden","");
        pGameArea.removeAttribute("hidden");

        var playback = new Playback(window.game, this.osu, this.osu.tracks[trackid]);
        game.scene = playback;
        playback.start();
    }


    // web page elements
    var pDragbox = document.getElementById("beatmap-dragbox");
    var pDragboxInner = document.getElementById("beatmap-dragbox-inner");
    var pDragboxHint = document.getElementById("beatmap-dragbox-hint");
    var pBeatmapList = document.getElementById("beatmap-list");
    pDragboxHint.defaultHint = "Drag and drop a beatmap (.osz) file here";
    pDragboxHint.modeErrHint = "Only supports osu! (std) mode beatmaps. Drop another file.";
    pDragboxHint.nonValidHint = "Not a valid osz file. Drop another file.";
    pDragboxHint.noTransferHint = "Not receiving any file. Please retry.";
    pDragboxHint.nonOszHint = "Not an osz file. Drop another file.";
    pDragboxHint.loadingHint = "loading...";
    var pGameArea = document.getElementById("game-area");
    var pMainPage = document.getElementById("main-page");
    // controller

    function oszLoaded() {
        // Verify that this has all the pieces we need
        var map = new BeatmapController();
        map.osu = new Osu(window.osz.root);

        // ask sayobot of star ratings of beatmaps immediately when decoded
        map.osu.ondecoded = map.osu.requestStar;

        map.osu.onready = function() {
            map.osu.filterTracks();
            map.osu.sortTracks();
            map.osuReady = true;
            if (!_.some(map.osu.tracks, function(t) { return t.general.Mode === 0; })) {
                pDragboxHint.innerText = pDragboxHint.modeErrHint;
                return;
            }
            // create container of beatmap on web page
            let pBeatmapBox = document.createElement("div");
            let pBeatmapCover = document.createElement("img");
            let pBeatmapTitle = document.createElement("div");
            let pBeatmapAuthor = document.createElement("div");
            pBeatmapBox.className = "beatmapbox";
            pBeatmapCover.className = "beatmapcover";
            pBeatmapTitle.className = "beatmaptitle";
            pBeatmapAuthor.className = "beatmapauthor";
            pBeatmapBox.appendChild(pBeatmapCover);
            pBeatmapBox.appendChild(pBeatmapTitle);
            pBeatmapBox.appendChild(pBeatmapAuthor);
            // set beatmap title & artist display (prefer ascii title)
            var title = map.osu.tracks[0].metadata.Title;
            var artist = map.osu.tracks[0].metadata.Artist;
            var creator = map.osu.tracks[0].metadata.Creator;
            pBeatmapTitle.innerText = title;
            pBeatmapAuthor.innerText = artist + " / " + creator;
            // set beatmap cover display
            pBeatmapCover.alt = "beatmap cover";
            map.osu.getCoverSrc(pBeatmapCover);
            // display beatmap length
            if (map.osu.tracks[0].length) {
                let pBeatmapLength = document.createElement("div");
                pBeatmapLength.className = "beatmaplength";
                pBeatmapBox.appendChild(pBeatmapLength);
                let length = map.osu.tracks[0].length;
                pBeatmapLength.innerText = Math.floor(length/60) + ":" + (length%60<10?"0":"") + (length%60);
            }

            // add the container to page & restore drag box
            pBeatmapList.insertBefore(pBeatmapBox, pDragbox);
            pDragboxHint.innerText = pDragboxHint.defaultHint;
            // click Beatmap box to show difficulty selection menu
            pBeatmapBox.onclick = function(e) {
                // allow only one selection menu at a time
                if (!window.showingDifficultyBox) {
                    e.stopPropagation();
                    // create difficulty seleciton menu
                    // set menu position
                    let difficultyBox = document.createElement("div");
                    difficultyBox.className = "difficulty-box";
                    let rect = this.getBoundingClientRect();
                    let x = e.clientX - rect.left;
                    let y = e.clientY - rect.top; 
                    difficultyBox.style.left = x + "px";
                    difficultyBox.style.top = y + "px";
                    // close menu callback
                    var closeDifficultyMenu = function() {
                        pBeatmapBox.removeChild(difficultyBox);
                        window.showingDifficultyBox = false;
                        window.removeEventListener('click', closeDifficultyMenu, false);
                    };
                    // create difficulty list items
                    for (let i=0; i<map.osu.tracks.length; ++i) {
                        let difficultyItem = document.createElement("div");
                        let difficultyRing = document.createElement("div");
                        let difficultyText = document.createElement("span");
                        difficultyItem.className = "difficulty-item";
                        difficultyRing.className = "difficulty-ring";
                        // color ring acoording to Star; gray ring if unavailable
                        let star = map.osu.tracks[i].difficulty.star;
                        if (star) {
                            if (star<2) difficultyRing.classList.add("easy"); else
                            if (star<2.7) difficultyRing.classList.add("normal"); else
                            if (star<4) difficultyRing.classList.add("hard"); else
                            if (star<5.3) difficultyRing.classList.add("insane"); else
                            if (star<6.5) difficultyRing.classList.add("expert"); else
                                difficultyRing.classList.add("expert-plus");
                        }
                        difficultyText.innerText = map.osu.tracks[i].metadata.Version;
                        difficultyItem.appendChild(difficultyRing);
                        difficultyItem.appendChild(difficultyText);
                        difficultyBox.appendChild(difficultyItem);
                        // launch game if clicked inside
                        difficultyItem.onclick = function(e) {
                            e.stopPropagation();
                            closeDifficultyMenu();
                            map.startGame(i);
                        }
                    }
                    pBeatmapBox.appendChild(difficultyBox);
                    window.showingDifficultyBox = true;
                    // close menu if clicked outside
                    window.addEventListener("click", closeDifficultyMenu, false);
                }
            }
        };
        map.osu.onerror = function(error) {
            console.error("osu load error");
        };
        map.osu.load();
    }

    var handleDragDrop = function(e) {
        e.stopPropagation();
        e.preventDefault();
        pDragboxHint.innerText = pDragboxHint.loadingHint;
        var raw_file = e.dataTransfer.files[0];
        if (!raw_file) {
            pDragboxHint.innerText = pDragboxHint.noTransferHint;
            return;
        }
        // check suffix name
        if (raw_file.name.indexOf(".osz") === raw_file.name.length - 4) {
            var fs = window.osz = new zip.fs.FS();
            fs.root.importBlob(raw_file, oszLoaded,
                function(err) {
                    pDragboxHint.innerText = pDragboxHint.nonValidHint;
                });
        } else {
            pDragboxHint.innerText = pDragboxHint.nonOszHint;
        }
    }
    pDragbox.ondrop = handleDragDrop;

    window.addEventListener('dragover', function(e){(e||event).preventDefault()}, false);
    window.addEventListener('drop', function(e){(e||event).preventDefault()}, false);

    // load script done
    pDragboxHint.innerText = pDragboxHint.defaultHint;
    pDragboxInner.removeAttribute("hidden");
    window.scriptReady = true;
    document.getElementById("script-progress").innerText += " Done";

    PIXI.Sprite.prototype.bringToFront = function() {
        if (this.parent) {
            var parent = this.parent;
            parent.removeChild(this);
            parent.addChild(this);
        }
    }

    function gameLoop(timestamp) {
        var timediff = timestamp - game.lastFrameTime;

        if (game.cursor) {
            // Handle cursor
            game.cursor.x = game.mouseX;
            game.cursor.y = game.mouseY;
            game.cursor.bringToFront();
        }

        if (game.scene) {
            game.scene.render(timestamp);
        }

        app.renderer.render(game.stage);
        game.lastFrameTime = timestamp;

        window.requestAnimationFrame(gameLoop);
    }

    window.requestAnimationFrame(gameLoop);
});
