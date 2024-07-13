import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import './App.css';

const WebRTC = () => {
  const [socket, setSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peerConnections, setPeerConnections] = useState({});
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [callType, setCallType] = useState(''); // 'audio' or 'video'
  const localMediaRef = useRef(null);
  const remoteMediaRefs = useRef({});
  const roomId = 'chat-room';  // Change this for different rooms

  useEffect(() => {
    const newSocket = io('/');
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('user-connected', handleUserConnected);
      socket.on('offer', handleReceiveOffer);
      socket.on('answer', handleReceiveAnswer);
      socket.on('candidate', handleNewICECandidateMsg);
      socket.on('user-disconnected', handleUserDisconnected);
      socket.on('end-call', handleEndCall);
      socket.on('message', handleMessageReceived);
    }
  }, [socket]);

  const handleUserConnected = (userId) => {
    console.log(`User connected: ${userId}`);
  };

  const handleReceiveOffer = async (offer, senderId) => {
    const pc = createPeerConnection(senderId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', answer, roomId);
    setPeerConnections(prevConnections => ({ ...prevConnections, [senderId]: pc }));
  };

  const handleReceiveAnswer = async (answer, senderId) => {
    await peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(answer));
  };

  const handleNewICECandidateMsg = (candidate, senderId) => {
    const rtcCandidate = new RTCIceCandidate(candidate);
    peerConnections[senderId].addIceCandidate(rtcCandidate);
  };

  const handleUserDisconnected = (userId) => {
    if (peerConnections[userId]) {
      peerConnections[userId].close();
      delete peerConnections[userId];
      setPeerConnections({ ...peerConnections });
    }
  };

  const handleEndCall = () => {
    endCall();
  };

  const handleMessageReceived = (message) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const startCall = async (type) => {
    setCallType(type);
    try {
      const constraints = type === 'video' ? { video: true, audio: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localMediaRef.current.srcObject = stream;
      setLocalStream(stream);
      socket.emit('join', roomId);
    } catch (error) {
      console.error('Error accessing media devices.', error);
    }
  };

  const endCall = () => {
    Object.values(peerConnections).forEach(pc => pc.close());
    setPeerConnections({});
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    socket.emit('end-call', roomId);
  };

  const createPeerConnection = (userId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('candidate', candidate, roomId);
      }
    };

    pc.ontrack = ({ streams: [stream] }) => {
      if (!remoteMediaRefs.current[userId]) {
        remoteMediaRefs.current[userId] = React.createRef();
      }
      remoteMediaRefs.current[userId].current.srcObject = stream;
    };

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    return pc;
  };

  const callUser = async (userId) => {
    const pc = createPeerConnection(userId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', offer, roomId);
    setPeerConnections(prevConnections => ({ ...prevConnections, [userId]: pc }));
  };

  const sendMessage = (e) => {
    e.preventDefault();
    socket.emit('message', newMessage, roomId);
    setMessages((prevMessages) => [...prevMessages, `Me: ${newMessage}`]);
    setNewMessage('');
  };

  return (
    <div className="webrtc-container">
      <h1>WebRTC Chat & Call</h1>
      <div className="buttons">
        <button onClick={() => startCall('audio')} className="call-button">Start Audio Call</button>
        <button onClick={() => startCall('video')} className="call-button">Start Video Call</button>
        <button onClick={endCall} className="end-call-button">End Call</button>
      </div>
      <div className="media-container">
        {/* Local video preview */}
        {callType === 'video' && (
          <video ref={localMediaRef} autoPlay playsInline className="local-media-preview" />
        )}
        {/* Remote video feeds */}
        {Object.keys(peerConnections).map(userId => (
          <video
            key={userId}
            ref={remoteMediaRefs.current[userId]}
            autoPlay
            playsInline
            className="remote-media"
          />
        ))}
      </div>
      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className="message">{msg}</div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="message-form">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="message-input"
            placeholder="Type a message"
          />
          <button type="submit" className="send-button">Send</button>
        </form>
      </div>
    </div>
  );
};

export default WebRTC;
