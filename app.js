import {initializeApp} from "firebase/app";
import {getFirestore} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCE6uu63O91LA5eCfKKIz6n5_dHWm4nwpw",
  authDomain: "videocall-174e6.firebaseapp.com",
  projectId: "videocall-174e6",
  storageBucket: "videocall-174e6.firebasestorage.app",
  messagingSenderId: "965109245557",
  appId: "1:965109245557:web:eb5e5c760d3b41dbda7a3c",
  measurementId: "G-N1W0W2C8X0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


const servers = {
    iceServers: [
        {
            urls:["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"]
        }
    ],
    iceCandidatePoolSize: 10,
};

const pc = new RTCPeerConnection(servers);
let localStream;
let remoteStream;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const callButton = document.getElementById("callButton");
const hangupButton = document.getElementById("hangupButton");

const answerSdp = document.getElementById("answerSdp");
const answerButton = document.getElementById("answerButton");

const openWebcam = document.getElementById("openWebcam");
openWebcam.addEventListener("click", async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });
        remoteStream = new MediaStream();
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });
        pc.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
        };
        localVideo.srcObject = localStream;
        remoteVideo.srcObject = remoteStream;
    } catch (error) {
        console.error("Error accessing webcam:", error);
    }
})

callButton.addEventListener("click",async () => {
    const callDoc = db.collection("calls").doc();
    const offerCandidate = callDoc.collection("offerCandidates");
    const answerCandidate = callDoc.collection("answerCandidates");

    answerSdp.value = callDoc.id;

    pc.onicecandidate = (event) => {
        event.candidate && offerCandidate.add(event.candidate.toJSON());
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const offerObj={
        sdp: offer.sdp,
        type: offer.type,
    }

    await callDoc.set({
        offer: offerObj,
    });

    callDoc.onSnapshot((snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
            const answer = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answer);

        }
    })

    answerCandidate.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);

            }
        })
    })
})



answerButton.addEventListener("click", async () => {
    const callId = answerSdp.value;
    const callDoc = db.collection("calls").doc(callId);
    const answerCandidate = callDoc.collection("answerCandidates");

    pc.onicecandidate = (event) => {
        event.candidate && answerCandidate.add(event.candidate.toJSON());
    }

    const callData = (await callDoc.get()).data();
    
    const callOfferDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(callOfferDescription));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const answerObj = {
        sdp: answer.sdp,
        type: answer.type,
    }

    await callDoc.update({
        answer: answerObj,
    });

    offerCandidate.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            console.log(change);
            if (change.type === "added") {
                let data = change.doc.data();
                pc.addIceCandidate(new RTCIceCandidate(data));
            }
        })
    })
        
        
    
        
})
