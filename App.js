import React, {useEffect, useState, useRef} from 'react';
import {
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import TextInputContainer from './components/TextInputContainer';
import SocketIOClient from 'socket.io-client';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCView,
  RTCIceCandidate,
  RTCSessionDescription,
} from 'react-native-webrtc';
import CallEnd from './asset/CallEnd';
import CallAnswer from './asset/CallAnswer';
import MicOn from './asset/MicOn';
import MicOff from './asset/MicOff';
import VideoOn from './asset/VideoOn';
import VideoOff from './asset/VideoOff';
import CameraSwitch from './asset/CameraSwitch';
import IconContainer from './components/IconContainer';
import InCallManager from 'react-native-incall-manager';

export default function App({}) {
  const [localStream, setlocalStream] = useState(new MediaStream());

  const [remoteStream, setRemoteStream] = useState(null);

  const [type, setType] = useState('JOIN');

  const [callerId] = useState(
    Math.floor(100000 + Math.random() * 900000).toString(),
  );
  const otherUserId = useRef(null);

  const socket = SocketIOClient('http://192.168.29.164:3500', {
    transports: ['websocket'],
    query: {
      callerId,
    },
  });

  const [localMicOn, setlocalMicOn] = useState(true);

  const [localWebcamOn, setlocalWebcamOn] = useState(true);

  let peerConnection = useRef(
    new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
        {
          urls: 'stun:stun1.l.google.com:19302',
        },
        {
          urls: 'stun:stun2.l.google.com:19302',
        },
      ],
    }),
  );

  let remoteCandidates = [];

  let mediaConstraints = {
    audio: true,
    video: {
      frameRate: 30,
      facingMode: 'user',
    },
  };

  let isVoiceOnly = false;

  const permisions = async () => {
    try {
      const mediaStream = await mediaDevices.getUserMedia(mediaConstraints);

      if (isVoiceOnly) {
        let videoTrack = await mediaStream.getVideoTracks()[0];
        videoTrack.enabled = false;
      }
      console.log(mediaStream, '=============');

      // localMediaStream = mediaStream;
      setlocalStream(mediaStream);
    } catch (err) {
      // Handle Error
    }
  };

  // let peerConstraints = {
  //   iceServers: [
  //     {
  //       urls: 'stun:stun.l.google.com:19302',
  //     },
  //   ],
  // };

  // let peerConnection = new RTCPeerConnection(peerConstraints);

  useEffect(() => {
    peerConnection.current.addEventListener('connectionstatechange', event => {
      console.log(event, '===========connectionstatechange');
      switch (peerConnection.current.connectionState) {
        case 'closed':
          setType('JOIN');
          // console.log(isClosed)
          // You can handle the call being disconnected here.

          break;
      }
    });

    peerConnection.current.addEventListener('icecandidate', event => {
      console.log(event, '===========icecandidate');
      // When you find a null candidate then there are no more candidates.
      // Gathering of candidates has finished.
      if (event?.candidate && event?.candidate?.sdpMid) {
        console.log(event?.candidate, '==========event?.candidate?');
        sendICEcandidate({
          calleeId: otherUserId.current,
          rtcMessage: {
            label: event?.candidate?.sdpMLineIndex,
            id: event?.candidate?.sdpMid,
            candidate: event?.candidate?.candidate,
          },
        });
      } else {
        console.log('End of candidates.');
      }
      // if (!event.candidate) {
      //   return;
      // }

      // Send the event.candidate onto the person you're calling.
      // Keeping to Trickle ICE Standards, you should send the candidates immediately.
    });

    peerConnection.current.addEventListener('icecandidateerror', event => {
      console.log(event, '===========icecandidateerror');
      // You can ignore some candidate errors.
      // Connections can still be made even when errors occur.
    });

    peerConnection.current.addEventListener(
      'iceconnectionstatechange',
      event => {
        console.log(event, '===========iceconnectionstatechange');
        switch (peerConnection.current.iceConnectionState) {
          case 'connected':
          case 'completed':
            // You can handle the call being connected here.
            // Like setting the video streams to visible.

            break;
        }
      },
    );

    peerConnection.current.addEventListener('negotiationneeded', event => {
      console.log(event, '===========negotiationneeded');
      // You can start the offer stages here.
      // Be careful as this event can be called multiple times.
    });

    peerConnection.current.addEventListener('signalingstatechange', event => {
      console.log(event, '===========signalingstatechange');
      switch (peerConnection.current.signalingState) {
        case 'closed':
          // You can handle the call being disconnected here.

          break;
      }
    });

    peerConnection.current.addEventListener('track', event => {
      console.log(event, '===========track');
      let steam = null;
      // Grab the remote track from the connected participant.
      steam = steam || new MediaStream();
      steam?.addTrack(event.track, steam);
      setRemoteStream(steam);
    });

    return () => {
      peerConnection.current.close();
      peerConnection = null;
    };
  }, []);

  useEffect(() => {
    if (localStream) {
      // Add our stream to the peer connection.
      localStream
        .getTracks()
        .forEach(track => peerConnection.current.addTrack(track, localStream));
    }
  }, [localStream]);

  function handleRemoteCandidate(iceCandidate) {
    iceCandidate = new RTCIceCandidate(iceCandidate);

    if (peerConnection.current.remoteDescription == null) {
      return remoteCandidates.push(iceCandidate);
    }

    return peerConnection.current.addIceCandidate(iceCandidate);
  }

  function processCandidates() {
    if (remoteCandidates.length < 1) {
      return;
    }

    remoteCandidates.map(candidate =>
      peerConnection.current.addIceCandidate(candidate),
    );
    remoteCandidates = [];
  }

  let remoteRTCMessage = useRef(null);

  useEffect(() => {
    permisions();
    socket.on('newCall', data => {
      remoteRTCMessage.current = data.rtcMessage;
      otherUserId.current = data.callerId;
      setType('INCOMING_CALL');
    });

    socket.on('callAnswered', async data => {
      try {
        console.log(data, '===========callAnsweredcallAnswered');
        // Use the received answerDescription
        remoteRTCMessage.current = data.rtcMessage;
        const answerDescription = new RTCSessionDescription(data.rtcMessage);
        await peerConnection.current.setRemoteDescription(answerDescription);
        setType('WEBRTC_ROOM');
      } catch (err) {
        console.log(err, '========================errr');
        // Handle Error
      }
      // const answerDescription = new RTCSessionDescription( answerDescription );
      // await peerConnection.current.setRemoteDescription( answerDescription );
      // peerConnection.current.setRemoteDescription(
      //   new RTCSessionDescription(remoteRTCMessage.current),
      // );
    });

    socket.on('ICEcandidate', data => {
      let message = data.rtcMessage;
      console.log(
        message,
        '=================messagemessagemessagemessagemessage',
      );

      if (peerConnection.current) {
        handleRemoteCandidate({
          candidate: message?.candidate,
          sdpMLineIndex: message?.label,
          sdpMid: message?.id,
        });
        peerConnection.current
          .addIceCandidate(
            new RTCIceCandidate({
              candidate: message.candidate,
              sdpMid: message.id,
              sdpMLineIndex: message.label,
            }),
          )
          .then(data => {
            console.log('SUCCESS');
          })
          .catch(err => {
            console.log('Error', err);
          });
      }
    });

    // let isFront = false;

    // mediaDevices.enumerateDevices().then(sourceInfos => {
    //   let videoSourceId;
    //   for (let i = 0; i < sourceInfos.length; i++) {
    //     const sourceInfo = sourceInfos[i];
    //     if (
    //       sourceInfo.kind == 'videoinput' &&
    //       sourceInfo.facing == (isFront ? 'user' : 'environment')
    //     ) {
    //       videoSourceId = sourceInfo.deviceId;
    //     }
    //   }

    //   mediaDevices
    //     .getUserMedia({
    //       audio: true,
    //       video: {
    //         mandatory: {
    //           minWidth: 500, // Provide your own width, height and frame rate here
    //           minHeight: 300,
    //           minFrameRate: 30,
    //         },
    //         facingMode: isFront ? 'user' : 'environment',
    //         optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
    //       },
    //     })
    //     .then(stream => {
    //       // Got stream!

    //       setlocalStream(stream);

    //       // setup stream listening
    //       peerConnection.current.addStream(stream);
    //     })
    //     .catch(error => {
    //       // Log error
    //     });
    // });

    // peerConnection.current.onaddstream = event => {
    //   setRemoteStream(event.stream);
    // };

    // Setup ice handling
    // peerConnection.current.onicecandidate = event => {
    //   if (event.candidate) {
    //     sendICEcandidate({
    //       calleeId: otherUserId.current,
    //       rtcMessage: {
    //         label: event.candidate.sdpMLineIndex,
    //         id: event.candidate.sdpMid,
    //         candidate: event.candidate.candidate,
    //       },
    //     });
    //   } else {
    //     console.log('End of candidates.');
    //   }
    // };

    return () => {
      socket.off('newCall');
      socket.off('callAnswered');
      socket.off('ICEcandidate');
    };
  }, []);

  useEffect(() => {
    InCallManager.start();
    InCallManager.setKeepScreenOn(true);
    InCallManager.setForceSpeakerphoneOn(true);

    return () => {
      InCallManager.stop();
    };
  }, []);

  function sendICEcandidate(data) {
    console.log(data, '======sendICEcandidatesendICEcandidatesendICEcandidate');
    socket.emit('ICEcandidate', data);
  }

  async function processCall() {
    try {
      let sessionConstraints = {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true,
          VoiceActivityDetection: true,
        },
      };
      const sessionDescription = await peerConnection.current.createOffer(
        sessionConstraints,
      );
      await peerConnection.current.setLocalDescription(sessionDescription);
      sendCall({
        calleeId: otherUserId.current,
        rtcMessage: sessionDescription,
      });
    } catch (error) {
      console.log(error, '31111');
    }
  }

  async function processAccept() {
    try {
      // Use the received offerDescription
      const offerDescription = new RTCSessionDescription(
        remoteRTCMessage.current,
      );
      await peerConnection.current.setRemoteDescription(offerDescription);

      const sessionDescription = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(sessionDescription);

      // Here is a good place to process candidates.
      processCandidates();

      answerCall({
        callerId: otherUserId.current,
        rtcMessage: sessionDescription,
      });

      // Send the answerDescription back as a response to the offerDescription.
    } catch (err) {
      console.log(err, '===========354==========');
      // Handle Errors
    }

    // peerConnection.current.setRemoteDescription(
    //   new RTCSessionDescription(remoteRTCMessage.current),
    // );
    // const sessionDescription = await peerConnection.current.createAnswer();
    // await peerConnection.current.setLocalDescription(sessionDescription);
  }

  function answerCall(data) {
    socket.emit('answerCall', data);
  }

  function sendCall(data) {
    socket.emit('call', data);
  }

  const JoinScreen = () => {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          flex: 1,
          backgroundColor: '#050A0E',
          justifyContent: 'center',
          paddingHorizontal: 42,
        }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <>
            <View
              style={{
                padding: 35,
                backgroundColor: '#1A1C22',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 14,
              }}>
              <Text
                style={{
                  fontSize: 18,
                  color: '#D0D4DD',
                }}>
                Your Caller ID
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  marginTop: 12,
                  alignItems: 'center',
                }}>
                <Text
                  style={{
                    fontSize: 32,
                    color: '#ffff',
                    letterSpacing: 6,
                  }}>
                  {callerId}
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: '#1A1C22',
                padding: 40,
                marginTop: 25,
                justifyContent: 'center',
                borderRadius: 14,
              }}>
              <Text
                style={{
                  fontSize: 18,
                  color: '#D0D4DD',
                }}>
                Enter call id of another user
              </Text>
              <TextInputContainer
                placeholder={'Enter Caller ID'}
                value={otherUserId.current}
                setValue={text => {
                  otherUserId.current = text;
                  console.log('TEST', otherUserId.current);
                }}
                keyboardType={'number-pad'}
              />
              <TouchableOpacity
                onPress={() => {
                  setType('OUTGOING_CALL');
                  processCall();
                }}
                style={{
                  height: 50,
                  backgroundColor: '#5568FE',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 12,
                  marginTop: 16,
                }}>
                <Text
                  style={{
                    fontSize: 16,
                    color: '#FFFFFF',
                  }}>
                  Call Now
                </Text>
              </TouchableOpacity>
            </View>
          </>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  };

  const OutgoingCallScreen = () => {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'space-around',
          backgroundColor: '#050A0E',
        }}>
        <View
          style={{
            padding: 35,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 14,
          }}>
          <Text
            style={{
              fontSize: 16,
              color: '#D0D4DD',
            }}>
            Calling to...
          </Text>

          <Text
            style={{
              fontSize: 36,
              marginTop: 12,
              color: '#ffff',
              letterSpacing: 6,
            }}>
            {otherUserId.current}
          </Text>
        </View>
        <View
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <TouchableOpacity
            onPress={() => {
              setType('JOIN');
              otherUserId.current = null;
            }}
            style={{
              backgroundColor: '#FF5D5D',
              borderRadius: 30,
              height: 60,
              aspectRatio: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <CallEnd width={50} height={12} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const IncomingCallScreen = () => {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'space-around',
          backgroundColor: '#050A0E',
        }}>
        <View
          style={{
            padding: 35,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 14,
          }}>
          <Text
            style={{
              fontSize: 36,
              marginTop: 12,
              color: '#ffff',
            }}>
            {otherUserId.current} is calling..
          </Text>
        </View>
        <View
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <TouchableOpacity
            onPress={() => {
              processAccept();
              setType('WEBRTC_ROOM');
            }}
            style={{
              backgroundColor: 'green',
              borderRadius: 30,
              height: 60,
              aspectRatio: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <CallAnswer height={28} fill={'#fff'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  async function switchCamera() {
    try {
      // Taken from above, we don't want to flip if we don't have another camera.
      // if (cameraCount < 2) {
      //   return;
      // }

      const videoTrack = await localStream.getVideoTracks()[0];
      videoTrack._switchCamera();
    } catch (err) {
      // Handle Error
    }
  }

  function toggleCamera() {
    localWebcamOn ? setlocalWebcamOn(false) : setlocalWebcamOn(true);
    localStream.getVideoTracks().forEach(track => {
      localWebcamOn ? (track.enabled = false) : (track.enabled = true);
    });
  }

  async function toggleMic() {
    // localStream.getAudioTracks().forEach(track => {
    //   localMicOn ? (track.enabled = false) : (track.enabled = true);
    // });
    try {
      const audioTrack = await localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      localMicOn ? setlocalMicOn(false) : setlocalMicOn(true);
    } catch (err) {
      console.log(err, '======toggleMictoggleMic');
      // Handle Error
    }
  }

  function leave() {
    peerConnection.current.close();
    setlocalStream(null);
    setType('JOIN');
  }

  {
    console.log(remoteStream, '===============REMOTE_STREAM');
  }

  const WebrtcRoomScreen = () => {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#050A0E',
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}>
        {localStream ? (
          <RTCView
            objectFit={'cover'}
            style={{flex: 1, backgroundColor: '#050A0E'}}
            streamURL={localStream.toURL()}
          />
        ) : null}
        {remoteStream ? (
          <RTCView
            objectFit={'cover'}
            style={{
              flex: 1,
              backgroundColor: '#050A0E',
              marginTop: 8,
            }}
            streamURL={remoteStream.toURL()}
          />
        ) : null}
        <View
          style={{
            marginVertical: 12,
            flexDirection: 'row',
            justifyContent: 'space-evenly',
          }}>
          <IconContainer
            backgroundColor={'red'}
            onPress={() => {
              leave();
            }}
            Icon={() => {
              return <CallEnd height={26} width={26} fill="#FFF" />;
            }}
          />
          <IconContainer
            style={{
              borderWidth: 1.5,
              borderColor: '#2B3034',
            }}
            backgroundColor={!localMicOn ? '#fff' : 'transparent'}
            onPress={() => {
              toggleMic();
            }}
            Icon={() => {
              return localMicOn ? (
                <MicOn height={24} width={24} fill="#FFF" />
              ) : (
                <MicOff height={28} width={28} fill="#1D2939" />
              );
            }}
          />
          <IconContainer
            style={{
              borderWidth: 1.5,
              borderColor: '#2B3034',
            }}
            backgroundColor={!localWebcamOn ? '#fff' : 'transparent'}
            onPress={() => {
              toggleCamera();
            }}
            Icon={() => {
              return localWebcamOn ? (
                <VideoOn height={24} width={24} fill="#FFF" />
              ) : (
                <VideoOff height={36} width={36} fill="#1D2939" />
              );
            }}
          />
          <IconContainer
            style={{
              borderWidth: 1.5,
              borderColor: '#2B3034',
            }}
            backgroundColor={'transparent'}
            onPress={() => {
              switchCamera();
            }}
            Icon={() => {
              return <CameraSwitch height={24} width={24} fill="#FFF" />;
            }}
          />
        </View>
      </View>
    );
  };

  switch (type) {
    case 'JOIN':
      return JoinScreen();
    case 'INCOMING_CALL':
      return IncomingCallScreen();
    case 'OUTGOING_CALL':
      return OutgoingCallScreen();
    case 'WEBRTC_ROOM':
      return WebrtcRoomScreen();
    default:
      return null;
  }
}
