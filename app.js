const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const audio = $("#audio");
const DB_NAME = "earUpDB", DB_VERSION = 1;
let db, tracks = [], playlists = [], currentTrackId = null, currentPlaylistId = null;
let queue = [], queueIndex = -1, shuffle = false, repeat = false, currentView = "listen";
let audioContext, sourceNode, analyser, filters = [], visualFrame, toastTimer;
const EQ_FREQS = [60, 170, 350, 1000, 3500, 10000];
const EQ_LABELS = ["60 Hz","170 Hz","350 Hz","1 kHz","3.5 kHz","10 kHz"];
const PRESETS = {flat:[0,0,0,0,0,0],bass:[7,5,2,0,-1,0],vocal:[-2,1,4,4,2,-1],treble:[-2,-1,0,1,5,7]};
const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random();
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains("tracks"))d.createObjectStore("tracks",{keyPath:"id"});if(!d.objectStoreNames.contains("playlists"))d.createObjectStore("playlists",{keyPath:"id"});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function store(name,mode="readonly"){return db.transaction(name,mode).objectStore(name);}
function getAll(name){return new Promise((res,rej)=>{const r=store(name).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
function put(name,value){return new Promise((res,rej)=>{const r=store(name,"readwrite").put(value);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
function del(name,key){return new Promise((res,rej)=>{const r=store(name,"readwrite").delete(key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
function notify(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2400);}
function fmt(sec){if(!Number.isFinite(sec))return "0:00";return `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,"0")}`;}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function titleFromFile(name){return name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").trim();}
function trackById(id){return tracks.find(t=>t.id===id);}
function artHTML(t,cls="track-cover"){return `<div class="${cls}">${t?.art?`<img src="${esc(t.art)}" alt="">`:"♫"}</div>`;}
function sortTracks(arr){return [...arr].sort((a,b)=>a.title.localeCompare(b.title));}
function showView(view,title){currentView=view;$$(".view").forEach(v=>v.classList.remove("active-view"));const el=$("#view-"+view);if(el)el.classList.add("active-view");$("#pageTitle").textContent=title;$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));}
function renderPlaylistNav(){const box=$("#playlistNav");box.innerHTML=playlists.length?playlists.map(p=>`<button class="playlist-link ${p.id===currentPlaylistId?"selected":""}" data-playlist="${p.id}">♫ &nbsp;${esc(p.name)}</button>`).join(""):'<p class="muted small empty-side">Your playlists will appear here.</p>';box.querySelectorAll("[data-playlist]").forEach(b=>b.onclick=()=>openPlaylist(b.dataset.playlist));}
function rowHTML(t){return `<div class="track-row" data-track="${t.id}">${artHTML(t)}<div class="track-info"><strong>${esc(t.title)}</strong><span>${esc(t.artist||"Unknown artist")}</span></div><span class="track-duration">${fmt(t.duration)}</span><button class="track-action ${t.favorite?"liked":""}" data-fav="${t.id}" title="Favorite">${t.favorite?"♥":"♡"}</button><button class="track-action" data-edit="${t.id}" title="Edit song details">✎</button><button class="track-play" data-play="${t.id}" title="Play">▶</button></div>`;}
function bindRows(root=document){root.querySelectorAll("[data-play]").forEach(b=>b.onclick=()=>playFromList(b.dataset.play));root.querySelectorAll("[data-fav]").forEach(b=>b.onclick=()=>toggleFavorite(b.dataset.fav));root.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editTrackDetails(b.dataset.edit));}
function renderAll(){tracks=tracks.sort((a,b)=>a.title.localeCompare(b.title));$("#songCount").textContent=tracks.length;renderPlaylistNav();$("#songsList").innerHTML=tracks.length?tracks.map(rowHTML).join(""):'<div class="empty-card"><h3>No songs yet</h3><p>Import audio files to build your library.</p><button class="primary-button" onclick="document.querySelector(\'#fileInput\').click()">Import music</button></div>';$("#favoritesList").innerHTML=tracks.filter(t=>t.favorite).map(rowHTML).join("")||'<p class="muted small">No favorites yet. Tap ♡ on a track to save it.</p>';const recent=[...tracks].filter(t=>t.lastPlayed).sort((a,b)=>b.lastPlayed-a.lastPlayed);$("#recentList").innerHTML=recent.map(rowHTML).join("")||'<p class="muted small">Your listening history will appear here.</p>';$("#recentGrid").innerHTML=recent.slice(0,4).map(rowHTML).join("");$("#favoriteGrid").innerHTML=tracks.filter(t=>t.favorite).slice(0,4).map(rowHTML).join("");$("#recentSection").classList.toggle("hidden",!recent.length);$("#favoriteSection").classList.toggle("hidden",!tracks.some(t=>t.favorite));$("#quickStart").classList.toggle("hidden",tracks.length>0);bindRows();renderPlaylistNav();if(currentPlaylistId)renderPlaylist();}
function renderPlaylist(){const p=playlists.find(x=>x.id===currentPlaylistId);if(!p)return;const items=(p.trackIds||[]).map(trackById).filter(Boolean);$("#playlistTitle").textContent=p.name;$("#playlistMeta").textContent=`${items.length} ${items.length===1?"song":"songs"}`;$("#playlistList").innerHTML=items.map(rowHTML).join("")||'<p class="muted small">This playlist is empty. Add songs from your library.</p>';bindRows($("#playlistList"));}
function openPlaylist(id){currentPlaylistId=id;const p=playlists.find(x=>x.id===id);if(!p)return;showView("playlist",p.name);renderPlaylistNav();renderPlaylist();}
function createPlaylist(name){const p={id:uid(),name,trackIds:[],createdAt:Date.now()};playlists.push(p);put("playlists",p).then(()=>{currentPlaylistId=p.id;renderAll();openPlaylist(p.id);notify("Playlist created");});}

// EarUp 2.0: lightweight ID3 reader for MP3 tags (title, artist, album).
function decodeID3Text(bytes, encoding){
  try {
    if (encoding===1 || encoding===2) return new TextDecoder(encoding===2?"utf-16be":"utf-16").decode(bytes).replace(/^\uFEFF/,"").replace(/\0+$/g,"").trim();
    return new TextDecoder("utf-8").decode(bytes).replace(/\0+$/g,"").trim();
  } catch { return ""; }
}
async function readMP3Tags(file){
  const tags={};
  try {
    const b=new Uint8Array(await file.slice(0,1024*1024).arrayBuffer());
    if(b[0]===73&&b[1]===68&&b[2]===51){
      const ver=b[3], size=((b[6]&127)<<21)|((b[7]&127)<<14)|((b[8]&127)<<7)|(b[9]&127); let pos=10,end=Math.min(10+size,b.length);
      while(pos+10<=end){const id=String.fromCharCode(...b.slice(pos,pos+4));if(!/^[A-Z0-9]{4}$/.test(id))break;const len=ver===4?((b[pos+4]&127)<<21)|((b[pos+5]&127)<<14)|((b[pos+6]&127)<<7)|(b[pos+7]&127):((b[pos+4]<<24)|(b[pos+5]<<16)|(b[pos+6]<<8)|b[pos+7]);if(!len||pos+10+len>end)break;const f=b.slice(pos+10,pos+10+len);const key={TIT2:"title",TPE1:"artist",TALB:"album"}[id];if(key&&f.length>1)tags[key]=decodeID3Text(f.slice(1),f[0]);pos+=10+len;}
    }
    if(!tags.title&&b.length>128){const v=b.slice(-128);if(String.fromCharCode(...v.slice(0,3))==="TAG"){tags.title=new TextDecoder().decode(v.slice(3,33)).replace(/\0/g,"").trim();tags.artist=new TextDecoder().decode(v.slice(33,63)).replace(/\0/g,"").trim();tags.album=new TextDecoder().decode(v.slice(63,93)).replace(/\0/g,"").trim();}}
  } catch(e){console.warn("MP3 tag read failed",e);}
  return tags;
}
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function lookupMusicMetadata(track){
  if(!track||!track.title)return;
  const safe=s=>String(s||"").replace(/["\\]/g," ").trim();
  const query=`recording:"${safe(track.title)}"${track.artist&&track.artist!=="Unknown artist"?` AND artist:"${safe(track.artist)}"`:""}`;
  try{
    const url=`https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
    const response=await fetch(url,{headers:{Accept:"application/json"}});if(!response.ok)throw new Error(`MusicBrainz ${response.status}`);
    const data=await response.json(), results=data.recordings||[];const norm=x=>(x||"").toLowerCase().replace(/[^a-z0-9]/g,"");
    const hit=results.find(r=>norm(r.title)===norm(track.title))||results[0];if(!hit)return;
    track.musicbrainzId=hit.id;
    if((!track.artist||track.artist==="Unknown artist")&&hit["artist-credit"]?.length)track.artist=hit["artist-credit"].map(x=>x.name||x.artist?.name).filter(Boolean).join("");
    const rel=hit.releases?.find(x=>x["release-group"]?.id)||hit.releases?.[0];
    if(rel){if(!track.album||track.album==="Local library")track.album=rel.title;track.releaseGroupId=rel["release-group"]?.id;track.releaseId=rel.id;if(track.releaseGroupId)track.art=`https://coverartarchive.org/release-group/${track.releaseGroupId}/front-250`;}
    track.metadataMatched=true;await put("tracks",track);
    if(currentTrackId===track.id){$("#nowArtist").textContent=track.artist||"Unknown artist";if(track.art)$("#nowArt").innerHTML=`<img src="${esc(track.art)}" alt="Album artwork">`;}
  }catch(e){console.warn("MusicBrainz lookup unavailable",e);}
}
async function findLyrics(track){
  if(!track)return;if(!track.artist||track.artist==="Unknown artist"){notify("Artist not identified. Add artist information before searching lyrics.");return;}
  track.lyricsLookupAttempted=true;
  const source=$("#lyricsSource"), box=$("#syncedLyrics");if(source)source.textContent="Searching LRCLIB…";
  try{
    const q=new URLSearchParams({track_name:track.title,artist_name:track.artist});if(track.album&&track.album!=="Local library")q.set("album_name",track.album);if(track.duration>0)q.set("duration",String(Math.round(track.duration)));
    let response=await fetch(`https://lrclib.net/api/get?${q}`),record=null;
    if(response.ok)record=await response.json();else if(response.status===404){const fallback=new URLSearchParams({track_name:track.title,artist_name:track.artist});const sr=await fetch(`https://lrclib.net/api/search?${fallback}`);if(sr.ok){const arr=await sr.json();record=arr.find(x=>x.syncedLyrics||x.plainLyrics)||arr[0];}}else throw new Error(`LRCLIB ${response.status}`);
    if(!record||(!record.plainLyrics&&!record.syncedLyrics)){if(source)source.textContent="No match found. You can add lyrics manually.";notify("No lyrics match found");return;}
    track.lyrics=record.plainLyrics||record.syncedLyrics||"";track.syncedLyrics=record.syncedLyrics||"";track.lyricsSource="LRCLIB";await put("tracks",track);
    $("#lyricsText").value=track.lyrics;if(source)source.textContent=track.syncedLyrics?"Synchronized lyrics found · LRCLIB":"Lyrics found · LRCLIB";renderTimedLyrics(track);notify("Lyrics found and saved");
  }catch(e){console.warn(e);if(source)source.textContent="Lyrics service unavailable. Try again later.";notify("Could not reach LRCLIB");}
}
function renderTimedLyrics(track){
  const box=$("#syncedLyrics");if(!box)return;const raw=track?.syncedLyrics||"";if(!raw){box.classList.add("hidden");box.innerHTML="";return;}
  const lines=raw.split(/\r?\n/).map(line=>{const m=line.match(/^\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);return m?{time:Number(m[1])*60+Number(m[2])+Number("0."+(m[3]||"0")),text:m[4]}:null;}).filter(Boolean);
  if(!lines.length){box.classList.add("hidden");return;}box.classList.remove("hidden");box.innerHTML=lines.map((l,i)=>`<div class="lyric-line" data-time="${l.time}">${esc(l.text||"♪")}</div>`).join("");updateTimedLyrics();
}
function updateTimedLyrics(){const box=$("#syncedLyrics");if(!box||box.classList.contains("hidden"))return;const els=[...box.querySelectorAll("[data-time]")];let active=-1;els.forEach((el,i)=>{if(Number(el.dataset.time)<=audio.currentTime)active=i;el.classList.toggle("current",i===active);});if(active>=0){const el=els[active],top=el.offsetTop-box.offsetTop;if(top<box.scrollTop||top>box.scrollTop+box.clientHeight-35)box.scrollTo({top:Math.max(0,top-65),behavior:"smooth"});}}

async function importFiles(fileList){
  const files=[...fileList].filter(f=>f.type.startsWith("audio/")||/\.(mp3|m4a|wav|flac|ogg|aac)$/i.test(f.name));
  if(!files.length){notify("Choose supported audio files");return;}
  const imported=[];
  for(const file of files){const tags=/\.mp3$/i.test(file.name)?await readMP3Tags(file):{};const t={id:uid(),title:tags.title||titleFromFile(file.name),artist:tags.artist||"Unknown artist",album:tags.album||"Local library",duration:0,size:file.size,mime:file.type||"audio/mpeg",blob:file,favorite:false,lyrics:"",syncedLyrics:"",lastPlayed:0,addedAt:Date.now(),metadataMatched:false};tracks.push(t);imported.push(t);await put("tracks",t);}
  renderAll();notify(`${imported.length} song${imported.length===1?"":"s"} imported`);if(tracks.length===imported.length)showView("songs","All Songs");
  // MusicBrainz asks clients to stay at or below one request per second.
  for(const t of imported){await lookupMusicMetadata(t);renderAll();await wait(1100);}
}
function setupAudio(){if(audioContext)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC){notify("Web Audio is not supported in this browser");return;}audioContext=new AC();sourceNode=audioContext.createMediaElementSource(audio);filters=EQ_FREQS.map((f,i)=>{const node=audioContext.createBiquadFilter();node.type="peaking";node.frequency.value=f;node.Q.value=1;node.gain.value=0;return node;});analyser=audioContext.createAnalyser();analyser.fftSize=128;let chain=sourceNode;filters.forEach(f=>{chain.connect(f);chain=f;});chain.connect(analyser);analyser.connect(audioContext.destination);drawVisualizer();}
function drawVisualizer(){const canvas=$("#visualizer"),ctx=canvas.getContext("2d"),data=new Uint8Array(analyser.frequencyBinCount);function draw(){visualFrame=requestAnimationFrame(draw);analyser.getByteFrequencyData(data);ctx.clearRect(0,0,canvas.width,canvas.height);const n=32,w=canvas.width/n;for(let i=0;i<n;i++){const v=data[Math.floor(i*data.length/n)]/255;const h=Math.max(3,v*canvas.height*.88);ctx.fillStyle=`hsl(${345+i*1.3},75%,${52+v*16}%)`;ctx.beginPath();ctx.roundRect(i*w+2,(canvas.height-h)/2,Math.max(2,w-4),h,4);ctx.fill();}}draw();}
async function playTrack(id,list){const t=trackById(id);if(!t)return;if(list){queue=list.map(x=>x.id);queueIndex=queue.indexOf(id);}else if(!queue.includes(id)){queue=tracks.map(x=>x.id);queueIndex=queue.indexOf(id);}if(currentTrackId!==id){currentTrackId=id;audio.pause();if(audio.src)URL.revokeObjectURL(audio.src);audio.src=URL.createObjectURL(t.blob);$("#nowTitle").textContent=t.title;$("#nowArtist").textContent=t.artist||"Unknown artist";$("#nowArt").innerHTML=t.art?`<img src="${esc(t.art)}" alt="Album art">`:'<div class="art-placeholder">♫</div>';$("#nowFavorite").textContent=t.favorite?"♥":"♡";$("#nowFavorite").classList.toggle("liked",t.favorite);$("#lyricsSongCard").innerHTML=`${artHTML(t,"cover large")}<h3>${esc(t.title)}</h3><p class="muted">${esc(t.artist||"Unknown artist")}</p>`;$("#lyricsText").value=t.lyrics||"";$("#lyricsSource").textContent=t.lyricsSource?`Saved from ${t.lyricsSource}`:"Search LRCLIB for lyrics";renderTimedLyrics(t);t.lastPlayed=Date.now();await put("tracks",t);renderAll();}setupAudio();if(audioContext?.state==="suspended")await audioContext.resume();try{await audio.play();$("#playBtn").textContent="Ⅱ";$("#playerStatus").textContent="Playing from your library";}catch(e){notify("Playback could not start. Try pressing play again.");}}
function playFromList(id){const list=currentView==="playlist"?(playlists.find(p=>p.id===currentPlaylistId)?.trackIds||[]).map(trackById).filter(Boolean):currentView==="favorites"?tracks.filter(t=>t.favorite):currentView==="recent"?[...tracks].filter(t=>t.lastPlayed).sort((a,b)=>b.lastPlayed-a.lastPlayed):tracks;playTrack(id,list);}
function togglePlay(){if(!currentTrackId){if(tracks.length)playTrack(tracks[0].id);else notify("Import music to start listening");return;}if(audio.paused){setupAudio();audioContext?.resume();audio.play().then(()=>{$("#playBtn").textContent="Ⅱ";$("#playerStatus").textContent="Playing from your library";}).catch(()=>notify("Unable to play this file"));}else{audio.pause();$("#playBtn").textContent="▶";$("#playerStatus").textContent="Paused";}}
function nextTrack(direction=1){if(!queue.length)queue=tracks.map(t=>t.id);if(!queue.length)return;let idx=queueIndex;if(shuffle){idx=Math.floor(Math.random()*queue.length);}else idx=(idx+direction+queue.length)%queue.length;queueIndex=idx;playTrack(queue[idx]);}
async function editTrackDetails(id){const t=trackById(id);if(!t)return;const title=prompt("Song title:",t.title);if(title===null)return;const artist=prompt("Artist:",t.artist||"");if(artist===null)return;const album=prompt("Album:",t.album||"");if(album===null)return;t.title=title.trim()||t.title;t.artist=artist.trim()||"Unknown artist";t.album=album.trim()||"Local library";t.metadataMatched=false;await put("tracks",t);renderAll();notify("Song details updated");}
async function toggleFavorite(id=currentTrackId){const t=trackById(id);if(!t)return;t.favorite=!t.favorite;await put("tracks",t);$("#nowFavorite").textContent=t.favorite?"♥":"♡";$("#nowFavorite").classList.toggle("liked",t.favorite);renderAll();}
function renderEq(){const box=$("#eqSliders");box.innerHTML=EQ_FREQS.map((f,i)=>`<label class="eq-band"><b id="eqVal${i}">0 dB</b><input type="range" min="-12" max="12" step="1" value="0" data-eq="${i}"><span>${EQ_LABELS[i]}</span></label>`).join("");box.querySelectorAll("[data-eq]").forEach(input=>input.oninput=()=>{const i=+input.dataset.eq,v=+input.value;$("#eqVal"+i).textContent=v+" dB";if(filters[i])filters[i].gain.value=v;$$(".preset").forEach(p=>p.classList.remove("active"));});}
function setPreset(name){const values=PRESETS[name];values.forEach((v,i)=>{const input=$(`[data-eq="${i}"]`);if(input)input.value=v;$("#eqVal"+i).textContent=v+" dB";if(filters[i])filters[i].gain.value=v;});$$(".preset").forEach(p=>p.classList.toggle("active",p.dataset.preset===name));}
function openAddSongs(){const p=playlists.find(x=>x.id===currentPlaylistId);if(!p)return;$("#addSongsChoices").innerHTML=tracks.map(t=>`<label class="choice-row"><input type="checkbox" value="${t.id}" ${(p.trackIds||[]).includes(t.id)?"checked":""}><span>${esc(t.title)} <span class="muted">· ${esc(t.artist||"Unknown")}</span></span></label>`).join("")||'<p class="muted small">Import songs first.</p>';$("#addSongsDialog").showModal();$("#addSongsChoices").querySelectorAll("input").forEach(c=>c.onchange=async()=>{p.trackIds=p.trackIds||[];p.trackIds=c.checked?[...new Set([...p.trackIds,c.value])]:p.trackIds.filter(id=>id!==c.value);await put("playlists",p);renderPlaylist();$("#playlistMeta").textContent=`${p.trackIds.length} songs`;});}
function bindEvents(){
  $("#fileInput").onchange=e=>{importFiles(e.target.files);e.target.value="";};["importSideBtn","importTopBtn","heroImportBtn","emptyImportBtn","songsImportBtn"].forEach(id=>$("#"+id).onclick=()=>$("#fileInput").click());
  $("#newPlaylistBtn").onclick=()=>$("#playlistDialog").showModal();$("#playlistForm").onsubmit=e=>{e.preventDefault();const name=$("#playlistName").value.trim();if(name){createPlaylist(name);$("#playlistName").value="";$("#playlistDialog").close();}};
  $$(".nav-item").forEach(b=>b.onclick=()=>showView(b.dataset.view,({listen:"Listen Now",songs:"All Songs",favorites:"Favorites",recent:"Recently Played",lyrics:"Lyrics",equalizer:"Equalizer"})[b.dataset.view]));$$("[data-goto]").forEach(b=>b.onclick=()=>showView(b.dataset.goto,b.dataset.goto==="recent"?"Recently Played":"Favorites"));
  $("#playBtn").onclick=togglePlay;$("#prevBtn").onclick=()=>{if(audio.currentTime>3)audio.currentTime=0;else nextTrack(-1);};$("#nextBtn").onclick=()=>nextTrack(1);$("#shuffleBtn").onclick=()=>{shuffle=!shuffle;$("#shuffleBtn").classList.toggle("active",shuffle);notify(shuffle?"Shuffle on":"Shuffle off");};$("#repeatBtn").onclick=()=>{repeat=!repeat;$("#repeatBtn").classList.toggle("active",repeat);notify(repeat?"Repeat one on":"Repeat off");};
  $("#nowFavorite").onclick=()=>toggleFavorite();$("#volumeBar").oninput=e=>audio.volume=+e.target.value;audio.volume=.8;
  audio.ontimeupdate=()=>{if(audio.duration){$("#seekBar").value=audio.currentTime/audio.duration*1000;$("#currentTime").textContent=fmt(audio.currentTime);$("#duration").textContent=fmt(audio.duration);updateTimedLyrics();}};$("#seekBar").oninput=e=>{if(audio.duration)audio.currentTime=(+e.target.value/1000)*audio.duration;};audio.onended=()=>{if(repeat){audio.currentTime=0;audio.play();}else nextTrack(1);};audio.onloadedmetadata=()=>{const t=trackById(currentTrackId);if(t){if(!t.duration||!Number.isFinite(t.duration)){t.duration=audio.duration;put("tracks",t);renderAll();}if(!t.lyrics&&!t.lyricsLookupAttempted&&t.artist&&t.artist!=="Unknown artist")findLyrics(t);}};
  $("#fetchLyricsBtn").onclick=()=>findLyrics(trackById(currentTrackId));
  $("#saveLyricsBtn").onclick=async()=>{const t=trackById(currentTrackId);if(!t){notify("Play a song first");return;}t.lyrics=$("#lyricsText").value;await put("tracks",t);notify("Lyrics saved for this song");};
  $("#eqResetBtn").onclick=()=>setPreset("flat");$$(".preset").forEach(b=>b.onclick=()=>setPreset(b.dataset.preset));
  $("#playPlaylistBtn").onclick=()=>{const p=playlists.find(x=>x.id===currentPlaylistId);const list=(p?.trackIds||[]).map(trackById).filter(Boolean);if(list.length)playTrack(list[0].id,list);else notify("Add songs to this playlist first");};
  $("#addToPlaylistBtn").onclick=openAddSongs;$("#deletePlaylistBtn").onclick=async()=>{const p=playlists.find(x=>x.id===currentPlaylistId);if(p&&confirm(`Delete playlist "${p.name}"? Your songs will not be deleted.`)){await del("playlists",p.id);playlists=playlists.filter(x=>x.id!==p.id);currentPlaylistId=null;renderAll();showView("songs","All Songs");notify("Playlist deleted");}};
  $("#searchInput").oninput=e=>{const q=e.target.value.toLowerCase().trim();if(!q)return;showView("songs","Search results");const found=tracks.filter(t=>(t.title+" "+t.artist+" "+t.album).toLowerCase().includes(q));$("#songsList").innerHTML=found.map(rowHTML).join("")||'<p class="muted small">No matching songs.</p>';bindRows($("#songsList"));};
  $("#queueBtn").onclick=()=>showView("equalizer","Equalizer");$("#openLyricsBtn").onclick=()=>showView("lyrics","Lyrics");$("#openEqBtn").onclick=()=>showView("equalizer","Equalizer");
}
async function init(){try{db=await openDB();tracks=await getAll("tracks");playlists=await getAll("playlists");}catch(e){console.error(e);notify("Browser storage unavailable. Try another browser or a local server.");}bindEvents();renderEq();renderAll();}
init();
