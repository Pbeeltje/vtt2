"use client"

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import MainContent from "./MainContent";
import RightSideMenu from "./RightSideMenu";
import BottomBar from "./BottomBar";
import { toast } from "@/components/ui/use-toast";
import { getUserFromCookie } from "@/lib/auth";
import type { User } from "../types/user";
import type { Character } from "../types/character";
import ErrorBoundary from "./ErrorBoundary";
import type { DMImage } from "../types/image";
import type { LayerImage } from "../types/layerImage";
import DrawingLayer, { DrawingObject } from './DrawingLayer'; 
import CharacterPopup from "./character-popup/CharacterPopup";
import type { DarknessPath } from "./main-content/DarknessLayer";

// Define NewDrawingData here for now, ensure MainContent can import it or define its own.
export type NewDrawingData = Omit<DrawingObject, 'id' | 'createdAt' | 'createdBy' | 'sceneId'>;


export type MessageType = "user" | "system" | "diceRoll";

export interface ChatMessage {
  MessageId?: number;
  type: string;
  content: string;
  timestamp: string;
  username: string;
  senderType?: 'user' | 'character';
  UserId?: number;
  senderRole?: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [chatBackgroundColor, setChatBackgroundColor] = useState("bg-white");
  const [images, setImages] = useState<DMImage[]>([]);
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [middleLayerImages, setMiddleLayerImages] = useState<LayerImage[]>([]);
  const [topLayerImages, setTopLayerImages] = useState<LayerImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scenes, setScenes] = useState<DMImage[]>([]);
  const [selectedScene, setSelectedScene] = useState<DMImage | null>(null);
  const [gridSize, setGridSize] = useState<number>(50);
  const [gridColor, setGridColor] = useState<string>("rgba(0,0,0,0.1)");
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentTool, setCurrentTool] = useState<'brush' | 'cursor' | 'darknessEraser' | 'darknessBrush'>('cursor');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [drawings, setDrawings] = useState<DrawingObject[]>([]);
  const [selectedDrawing, setSelectedDrawing] = useState<DrawingObject | null>(null);
  const [sceneScale, setSceneScale] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeRightMenuTab, setActiveRightMenuTab] = useState<string>('chat');
  const [characterSheetModal, setCharacterSheetModal] = useState<Character | null>(null);
  // Darkness layer state
  const [darknessPaths, setDarknessPaths] = useState<DarknessPath[]>([]);
  const [isDarknessLayerVisible, setIsDarknessLayerVisible] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const currentSceneIdRef: React.MutableRefObject<number | null> = useRef<number | null>(null);
  const isSocketUpdateRef = useRef(false); // Ref to track socket updates

  // Refs for state accessed in socket handlers
  const userRef = useRef(user);
  const scenesRef = useRef(scenes);
  const selectedSceneRef = useRef(selectedScene);
  // Effect to keep refs updated
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { scenesRef.current = scenes; }, [scenes]);
  useEffect(() => { selectedSceneRef.current = selectedScene; }, [selectedScene]);

  const findMostRecentScene = (scenesToSearch: DMImage[]): DMImage | null => {
    let mostRecent = null;
    let mostRecentDate: Date | null = null;
    for (const scene of scenesToSearch) {
      if (!scene.SceneData) continue;
      try {
        const sceneData = JSON.parse(scene.SceneData);
        if (sceneData.savedAt) {
          const savedAtDate = new Date(sceneData.savedAt);
          if (!mostRecentDate || savedAtDate > mostRecentDate) {
            mostRecentDate = savedAtDate;
            mostRecent = scene;
          }
        }
      } catch (error) { console.error("Error parsing scene data for recency:", error); }
    }
    return mostRecent;
  };
  
  const handleLoadScene = async (scene: DMImage | null) => {
    if (!scene || !scene.Id) {
      setSelectedScene(null); 
      setBackgroundImage("");
      setMiddleLayerImages([]); 
      setTopLayerImages([]); 
      setDrawings([]);
      // Defaults for when no scene is loaded at all (e.g., initial state before any selection)
      setGridSize(50); 
      setGridColor("rgba(0,0,0,0.1)"); // Default visible grid if no scene is truly active
      setDarknessPaths([]);
      setIsDarknessLayerVisible(false);
      return;
    }
    setSelectedScene(scene); 
    setBackgroundImage(scene.Link);

    if (scene.SceneData) {
      try {
        const sceneData = JSON.parse(scene.SceneData);
        setGridSize(sceneData.gridSize || 50); 
        // Default to visible gray if gridColor is not specified in saved data
        setGridColor(sceneData.gridColor || "rgba(0,0,0,0.1)"); 
        setMiddleLayerImages(sceneData.elements?.middleLayer || []); 
        setTopLayerImages(sceneData.elements?.topLayer || []);
        setSceneScale(sceneData.scale || 1);
        // Load darkness paths from scene data
        setDarknessPaths(sceneData.darknessPaths || []);
        setIsDarknessLayerVisible(sceneData.isDarknessLayerVisible || false);
      } catch (error) {
        console.error("Error loading scene data:", error);
        toast({ title: "Error", description: "Failed to parse scene data.", variant: "destructive" });
        setMiddleLayerImages([]); 
        setTopLayerImages([]);
        setDarknessPaths([]);
        setIsDarknessLayerVisible(false);
        // Fallback to default visible grid on error
        setGridSize(50);
        setGridColor("rgba(0,0,0,0.1)");
      }
    } else {
      // This is a new scene (e.g. image just set as background without prior scene data)
      setGridSize(50); // Keep a default grid size
      setGridColor("transparent"); // Hide grid by default for new scenes
      setMiddleLayerImages([]); 
      setTopLayerImages([]);
      setDarknessPaths([]);
      setIsDarknessLayerVisible(false);
      setSceneScale(1);
    }
    try {
        const drawingsResponse = await fetch(`/api/drawings?sceneId=${scene.Id}`);
        if (drawingsResponse.ok) {
            const sceneDrawingsData = await drawingsResponse.json();
            if (Array.isArray(sceneDrawingsData)) setDrawings(sceneDrawingsData); else setDrawings([]);
        } else { 
          console.error("Failed to fetch drawings for scene:", scene.Id); setDrawings([]); 
        }
    } catch (error) { console.error("Error fetching drawings:", error); setDrawings([]); }
  };

  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);
      try {
        const publicScenesRes = await fetch('/api/public/scenes');
        let initialSceneToLoad: DMImage | null = null;
        if (publicScenesRes.ok) {
          const publicScenes = await publicScenesRes.json();
          if (Array.isArray(publicScenes) && publicScenes.length > 0) {
            initialSceneToLoad = findMostRecentScene(publicScenes) || publicScenes[0];
          }
        }
        if (initialSceneToLoad && initialSceneToLoad.Id) {
          await handleLoadScene(initialSceneToLoad);
        } else {
           const drawingsResponse = await fetch('/api/drawings'); 
           if (drawingsResponse.ok) {
             const existingDrawings = await drawingsResponse.json();
             if(Array.isArray(existingDrawings)) setDrawings(existingDrawings); else setDrawings([]);
           } else { 
             if(drawingsResponse.status !== 400) console.error("Failed to fetch initial drawings (no scene):", drawingsResponse.statusText);
             setDrawings([]);
           }
        }
        const userData = await getUserFromCookie();
        if (userData) {
          setUser(userData);
          const [characterData, chatData, userScenesData] = await Promise.all([
            fetch(`/api/characters`, { credentials: "include" }).then(res => res.ok ? res.json() : []).catch(() => { console.error("Characters fetch failed in initializeApp"); return [];}),
            fetch("/api/chat", { credentials: "include" }).then(res => res.ok ? res.json() : []).catch(() => { console.error("Chat fetch failed in initializeApp"); return []; }),
            fetch("/api/scenes", { credentials: "include" }).then(res => res.ok ? res.json() : []).catch(() => { console.error("Scenes fetch failed in initializeApp"); return []; })
          ]);
          setCharacters(characterData);
          setMessages(chatData.map((msg: any) => {
            return { 
              MessageId: msg.MessageId, 
              type: msg.Type as string, 
              content: msg.Content, 
              timestamp: msg.Timestamp, 
              username: msg.Username, 
              UserId: msg.UserId,
              senderType: msg.SenderType as 'user' | 'character', 
              senderRole: msg.SenderRole as string, 
            };
          }));
          setScenes(userScenesData);
          if (userData.role === "DM") {
            await fetchImages();
            await fetchAllUsers(userData.role);
          }
          if (!initialSceneToLoad && userScenesData.length > 0) {
            const mostRecentUserScene = findMostRecentScene(userScenesData);
            if (mostRecentUserScene) await handleLoadScene(mostRecentUserScene);
          }
        }
      } catch (error) { console.error("Error initializing app:", error); toast({ title: "Error", description: "Failed to initialize application.", variant: "destructive" });
      } finally { setIsLoading(false); setIsInitialized(true); }
    };
    void initializeApp();

    socketRef.current = io(); 
    const socket = socketRef.current;
    socket.on('connect', () => {
      console.log('Socket.IO: Connected to server with ID:', socket.id);
      if (currentSceneIdRef.current) { socket.emit('join_scene', String(currentSceneIdRef.current)); }
    });
    socket.on('disconnect', (reason) => { console.log('Socket.IO: Disconnected, reason:', reason); });
    socket.on('connect_error', (err) => { console.error('Socket.IO: Connection Error:', err); });
    
    socket.on('drawing_added', (newDrawing: DrawingObject) => {
      console.log(`[Socket.IO Home] drawing_added received. Current scene: ${currentSceneIdRef.current}. User: ${user?.username}`, newDrawing);
      if (String(newDrawing.sceneId) === String(currentSceneIdRef.current)) {
        console.log(`[Socket.IO Home] drawing_added: Scene IDs match. User: ${user?.username}`);
        setDrawings((prev) => prev.find(d => d.id === newDrawing.id) ? prev : [...prev, newDrawing]);
      } else {
        console.log(`[Socket.IO Home] drawing_added: Scene IDs do NOT match. Ignoring. User: ${user?.username}`);
      }
    });
    socket.on('drawing_removed', (drawingId: string, sceneId: number) => {
      console.log('Socket.IO: drawing_removed received', drawingId, sceneId);
      if (String(sceneId) === String(currentSceneIdRef.current)) {
        setDrawings((prev) => prev.filter(d => d.id !== drawingId));
      }
    });

    socket.on('new_message', (incomingMessage: any) => {
      // console.log('Socket.IO: new_message received', incomingMessage); // Removed as per user request
      // Map properties from incomingMessage (which might have uppercase) to ChatMessage interface
      const formattedNewMessage: ChatMessage = {
        MessageId: incomingMessage.MessageId,
        type: incomingMessage.Type as string,
        content: incomingMessage.Content,
        timestamp: incomingMessage.Timestamp,
        username: incomingMessage.Username,
        senderType: incomingMessage.SenderType as 'user' | 'character',
        UserId: incomingMessage.UserId,
        senderRole: incomingMessage.SenderRole as string,
      };
      setMessages((prevMessages) => {
        if (prevMessages.find(msg => msg.MessageId === formattedNewMessage.MessageId)) {
          return prevMessages; // Already exists
        }
        return [...prevMessages, formattedNewMessage];
      });
    });

    socket.on('player_token_placed', (receivedSceneId: number, placedTokenData: LayerImage) => {
      const currentUser = userRef.current;
      const currentSceneId = currentSceneIdRef.current; // currentSceneIdRef is already a ref and updated by useEffect
      console.log(`[Socket.IO Home] player_token_placed received for scene ${receivedSceneId}. Current scene: ${currentSceneId}. User: ${currentUser?.username}`, placedTokenData);
      if (String(receivedSceneId) === String(currentSceneId)) {
        console.log(`[Socket.IO Home] player_token_placed: Scene IDs match. Setting isSocketUpdateRef = true (as it modifies topLayerImages). User: ${currentUser?.username}`);
        isSocketUpdateRef.current = true; // Because this event will change topLayerImages, which is a dependency of the save useEffect
        setTopLayerImages((prevTopLayer) => {
          // Avoid duplicates if the player placing the token also gets this event
          if (prevTopLayer.find(token => token.id === placedTokenData.id)) {
            return prevTopLayer.map(token => token.id === placedTokenData.id ? placedTokenData : token);
          }
          return [...prevTopLayer, placedTokenData];
        });
      } else {
        console.log(`[Socket.IO Home] player_token_placed: Scene IDs do NOT match. Ignoring. User: ${currentUser?.username}`);
      }
    });

    socket.on('scene_updated', (receivedSceneId: number, sceneUpdate: { middleLayer: LayerImage[], topLayer: LayerImage[], gridSize?: number, gridColor?: string, scale?: number }) => {
      const currentUser = userRef.current;
      const currentSceneId = currentSceneIdRef.current;
      console.log(`[Socket.IO Home] scene_updated received for scene ${receivedSceneId}. Current scene: ${currentSceneId}. current user: ${currentUser?.username}`, sceneUpdate);
      if (String(receivedSceneId) === String(currentSceneId)) {
        console.log(`[Socket.IO Home] scene_updated: Scene IDs match. Setting isSocketUpdateRef = true. User: ${currentUser?.username}`);
        isSocketUpdateRef.current = true;
        
        // Use setTimeout to ensure the flag is set before state updates trigger useEffect
        setTimeout(() => {
          setMiddleLayerImages(sceneUpdate.middleLayer || []);
          setTopLayerImages(sceneUpdate.topLayer || []);
          if (sceneUpdate.gridSize !== undefined) {
            setGridSize(sceneUpdate.gridSize);
          }
          if (sceneUpdate.gridColor !== undefined) {
            setGridColor(sceneUpdate.gridColor);
          }
          if (sceneUpdate.scale !== undefined) {
            setSceneScale(sceneUpdate.scale);
          }
        }, 0);
      } else {
        console.log(`[Socket.IO Home] scene_updated: Scene IDs do NOT match. Ignoring. User: ${currentUser?.username}`);
      }
    });

    socket.on('force_scene_change', (newSceneId: number | string) => {
      const currentUser = userRef.current;
      const currentScenes = scenesRef.current;
      const currentSelectedScene = selectedSceneRef.current;

      console.log(`[Socket.IO Home] Received \'force_scene_change\' to scene ID: ${newSceneId}. Current user in handler: ${currentUser?.username}, Role: ${currentUser?.role}`);

      if (String(currentSelectedScene?.Id) === String(newSceneId)) {
        console.log(`[Socket.IO Home] User ${currentUser?.username} already on scene ${newSceneId}, no forced change needed.`);
        return;
      }

      let sceneToLoad = currentScenes.find(s => String(s.Id) === String(newSceneId));

      if (sceneToLoad) {
        console.log(`[Socket.IO Home] User ${currentUser?.username} is now loading scene (from local list): ${sceneToLoad.Name} (ID: ${newSceneId}) due to force_scene_change.`);
        handleLoadScene(sceneToLoad);
      } else {
        console.warn(`[Socket.IO Home] Scene ID ${newSceneId} for force_scene_change not found in user ${currentUser?.username}\'s scenes list. Attempting to fetch directly.`);
        
        const fetchSceneDetailsAndLoad = async (id: string | number) => {
          try {
            const response = await fetch(`/api/scenes/${id}`); // Uses the new GET /api/scenes/[id]
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              let errorMessage = `Failed to fetch scene ${id}`;
              if (errorData.error) errorMessage += `: ${errorData.error}`;
              else errorMessage += ` (Status: ${response.status})`;
              throw new Error(errorMessage);
            }
            const fetchedScene: DMImage = await response.json();
            if (fetchedScene && fetchedScene.Id) {
              console.log(`[Socket.IO Home] Successfully fetched scene ${fetchedScene.Name} (ID: ${id}). Loading it now.`);
              // Optionally, add to the main \`scenes\` state if desired for future use.
              // This might be good so it's in their list if they navigate away and back.
              setScenes(prevScenes => {
                const exists = prevScenes.find(s => s.Id === fetchedScene.Id);
                return exists ? prevScenes : [...prevScenes, fetchedScene];
              });
              handleLoadScene(fetchedScene);
            } else {
              throw new Error(`Scene data for ID ${id} is invalid or not found after fetch.`);
            }
          } catch (error) {
            console.error(`[Socket.IO Home] Error fetching or loading scene ${id} directly:`, error);
            toast({
              title: "Scene Load Error",
              description: `Could not load forced scene (ID: ${id}). ${error instanceof Error ? error.message : 'Unknown error'}`,
              variant: "destructive",
            });
          }
        };
        fetchSceneDetailsAndLoad(newSceneId);
      }
    });

    // New listener for character updates (including assignment changes)
    socket.on('character_updated', (updatedCharacterFromServer: Character) => {
      console.log('[Socket.IO Home] character_updated received:', updatedCharacterFromServer);

      setCharacters((prevCharacters) => {
        const charExists = prevCharacters.find(c => c.CharacterId === updatedCharacterFromServer.CharacterId);
        if (charExists) {
          return prevCharacters.map((char) =>
            char.CharacterId === updatedCharacterFromServer.CharacterId ? updatedCharacterFromServer : char
          );
        }
        return prevCharacters;
      });

      setCharacterSheetModal((prevModalCharacter) => {
        if (prevModalCharacter && prevModalCharacter.CharacterId === updatedCharacterFromServer.CharacterId) {
          // console.log('[Socket.IO Home] setCharacterSheetModal: Updating for CharacterId:', updatedCharacterFromServer.CharacterId, 'New Name:', updatedCharacterFromServer.Name, 'New Level:', updatedCharacterFromServer.Level);
          return { ...updatedCharacterFromServer }; 
        }
        return prevModalCharacter;
      });
      
      // Toast notification if the current user is the new owner.
      if (userRef.current && updatedCharacterFromServer.userId === userRef.current.id) {
        const oldCharacterVersion = characters.find(c => c.CharacterId === updatedCharacterFromServer.CharacterId);
        if (oldCharacterVersion && oldCharacterVersion.userId !== updatedCharacterFromServer.userId) {
          toast({ 
            title: "New Character Assigned", 
            description: `You have been assigned the character: ${updatedCharacterFromServer.Name}.` 
          });
        } else if (!oldCharacterVersion && updatedCharacterFromServer.userId === userRef.current.id) {
           toast({ 
            title: "New Character Assigned", 
            description: `You have been assigned the character: ${updatedCharacterFromServer.Name}.` 
          });
        }
      }
    });

    // New listener for note updates
    socket.on('notes_updated', (updatedNotes: any[]) => {
      console.log('[Socket.IO Home] notes_updated received:', updatedNotes);
      
      // Dispatch a custom event that the BottomBar component can listen to
      const event = new CustomEvent('notes_updated', { detail: updatedNotes });
      window.dispatchEvent(event);
    });

    return () => { if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; } };
  }, []); // KEEP DEPS ARRAY EMPTY: Refs handle access to current state values.

  useEffect(() => {
    const socket = socketRef.current;
    const newSceneId = selectedScene?.Id;
    const oldSceneIdForEffect = currentSceneIdRef.current; // Capture before it's updated

    console.log(`[Socket.IO Home Scene Switch Effect] newSceneId: ${newSceneId}, oldSceneIdForEffect: ${oldSceneIdForEffect}, socketConnected: ${socket?.connected}, user: ${user?.username}`);

    if (socket && socket.connected) {
      if (oldSceneIdForEffect && oldSceneIdForEffect !== newSceneId) {
        socket.emit('leave_scene', String(oldSceneIdForEffect));
        console.log(`[Socket.IO Home Scene Switch Effect] Emitted 'leave_scene' for room: ${String(oldSceneIdForEffect)}, user: ${user?.username}`);
      }
      if (newSceneId && newSceneId !== oldSceneIdForEffect) {
        socket.emit('join_scene', String(newSceneId));
        console.log(`[Socket.IO Home Scene Switch Effect] Emitted 'join_scene' for room: ${String(newSceneId)}, user: ${user?.username}`);
      }
    }
    currentSceneIdRef.current = newSceneId ?? null;
  }, [selectedScene?.Id, socketRef.current?.connected]); // user?.username is not a direct dependency for join/leave but good for logging

  // Stubs for other functions - to be filled in later or kept if not related to current task
  const fetchCharacters = async () => {
    if (!user) return; // Should not happen if called after login
    try {
      const res = await fetch(`/api/characters`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCharacters(data);
      } else {
        console.error("Failed to fetch characters");
        setCharacters([]);
      }
    } catch (error) {
      console.error("Error fetching characters:", error);
      setCharacters([]);
    }
  };
  
  const fetchChatMessages = async () => {
    try {
      const res = await fetch("/api/chat", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.map((msg: any) => {
          return { 
            MessageId: msg.MessageId, 
            type: msg.Type as string, 
            content: msg.Content, 
            timestamp: msg.Timestamp, 
            username: msg.Username, 
            UserId: msg.UserId,
            senderType: msg.SenderType as 'user' | 'character', 
            senderRole: msg.SenderRole as string, 
          };
        }));
      } else {
        console.error("Failed to fetch chat messages");
        setMessages([]);
      }
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      setMessages([]);
    }
  };

  const fetchScenes = async () => {
    if (!user) return; // Should not happen
    try {
      const res = await fetch("/api/scenes", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setScenes(data);
        // Optionally, load the most recent user scene if no scene is currently selected
        if (!selectedScene && data.length > 0) {
          const mostRecentUserScene = findMostRecentScene(data);
          if (mostRecentUserScene) await handleLoadScene(mostRecentUserScene);
        }
      } else {
        console.error("Failed to fetch user scenes");
        setScenes([]);
      }
    } catch (error) {
      console.error("Error fetching user scenes:", error);
      setScenes([]);
    }
  };

  const fetchImages = async (sceneOnly:boolean=false) => {
    if (!user || user.role !== 'DM') return;
    try {
      // Assuming fetchImages without sceneOnly fetches all DM images
      // This might need adjustment based on actual API behavior for /api/images
      const endpoint = sceneOnly && selectedScene?.Id ? `/api/images?sceneId=${selectedScene.Id}` : '/api/images';
      const res = await fetch(endpoint, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setImages(data);
      } else {
        console.error("Failed to fetch images");
        setImages([]);
      }
    } catch (error) {
      console.error("Error fetching images:", error);
      setImages([]);
    }
  };

  const fetchAllUsers = async (currentUserRole?: string) => {
    const roleToCheck = currentUserRole || user?.role;
    if (roleToCheck !== 'DM') {
      setAllUsers([]);
      return;
    }
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setAllUsers(data);
        } else {
          setAllUsers([]);
        }
      } else {
        setAllUsers([]);
        toast({
          title: "Error Fetching Users",
          description: `Could not load user list: ${response.statusText}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      setAllUsers([]);
      toast({
        title: "Error",
        description: "An error occurred while fetching the user list.",
        variant: "destructive",
      });
    }
  };

  const loadUserData = async (loggedInUser: User) => {
    setUser(loggedInUser);
    console.log("[Home.tsx] loadUserData for:", loggedInUser.username, "Role:", loggedInUser.role);

    const [characterApiData, chatData, userScenesData] = await Promise.all([
      fetch(`/api/characters`, { credentials: "include" }).then(res => {
        if (!res.ok) { console.error("Failed to fetch characters in loadUserData"); return []; }
        return res.json();
      }).catch(() => { console.error("Characters fetch promise failed in loadUserData"); return [];}),
      fetch("/api/chat", { credentials: "include" }).then(res => res.ok ? res.json() : []).catch(() => { console.error("Chat fetch failed in loadUserData"); return []; }),
      fetch("/api/scenes", { credentials: "include" }).then(res => res.ok ? res.json() : []).catch(() => { console.error("Scenes fetch failed in loadUserData"); return []; })
    ]);

    setCharacters(characterApiData);
    setMessages(chatData.map((msg: any) => {
        return { 
          MessageId: msg.MessageId, 
          type: msg.Type as string,
          content: msg.Content, 
          timestamp: msg.Timestamp, 
          username: msg.Username, 
          senderType: msg.SenderType as 'user' | 'character', 
          UserId: msg.UserId,
          senderRole: msg.SenderRole as string,
        };
    }));
    setScenes(userScenesData);

    if (loggedInUser.role === "DM") {
      console.log("[Home.tsx] loadUserData: User is DM, calling fetchAllUsers and fetchImages.");
      await fetchImages();
      await fetchAllUsers(loggedInUser.role);
    } else {
      setAllUsers([]); // Clear allUsers if the newly loaded user is not DM
      setImages([]); // Clear images if not DM
    }
    
    // After fetching scenes, if no scene is selected, try to load the most recent user scene
    if (!selectedScene && scenes.length > 0) {
        const mostRecentUserScene = findMostRecentScene(scenes);
        if (mostRecentUserScene) {
            await handleLoadScene(mostRecentUserScene);
        }
    } else if (!selectedScene) {
        // If still no scene (e.g., new user with no scenes), try to load most recent public
        const publicScenesRes = await fetch('/api/public/scenes');
        if (publicScenesRes.ok) {
            const publicScenesData = await publicScenesRes.json();
            if (Array.isArray(publicScenesData) && publicScenesData.length > 0) {
                const initialPublicScene = findMostRecentScene(publicScenesData) || publicScenesData[0];
                if (initialPublicScene) await handleLoadScene(initialPublicScene);
            }
        }
    }
  };

  const handleLogin = async (_username: string, _role: string) => {
    // LoginForm already handles the API call and cookie setting.
    // This function is now primarily for updating client-side state post-login.
    setIsLoading(true);
    try {
      const userDataFromCookie = await getUserFromCookie();
      if (userDataFromCookie) {
        await loadUserData(userDataFromCookie);
        toast({ title: "Login Successful", description: `Welcome back, ${userDataFromCookie.username}!` });
      } else {
        toast({ title: "Login Error", description: "Could not retrieve user data after login.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error during post-login setup:", error);
      toast({ title: "Login Error", description: "An error occurred after logging in.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const addMessage = async (type: string, content: string, speakerName: string, senderType: 'user' | 'character') => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to send messages.", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, speakerName, senderType }),
      });

      if (response.ok) {
        const savedMessageFromServer = await response.json();
        // Map properties from savedMessageFromServer to ChatMessage interface
        const formattedSavedMessage: ChatMessage = {
          MessageId: savedMessageFromServer.MessageId,
          type: savedMessageFromServer.Type as string,
          content: savedMessageFromServer.Content,
          timestamp: savedMessageFromServer.Timestamp,
          username: savedMessageFromServer.Username,
          senderType: savedMessageFromServer.SenderType as 'user' | 'character',
          UserId: savedMessageFromServer.UserId,
          senderRole: savedMessageFromServer.SenderRole as string,
        };
        
        setMessages((prevMessages) => {
          if (prevMessages.find(msg => msg.MessageId === formattedSavedMessage.MessageId)) {
            return prevMessages; 
          }
          return [...prevMessages, formattedSavedMessage];
        });
      } else {
        const errorResult = await response.json().catch(() => ({ error: "Failed to send message." }));
        toast({ title: "Error", description: errorResult.error || "Failed to send message.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Network Error", description: "Could not send message.", variant: "destructive" });
    }
  };
  
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      setCharacters([]);
      setMessages([]);
      setScenes([]);
      setImages([]);
      setSelectedScene(null);
      setBackgroundImage("");
      setMiddleLayerImages([]);
      setTopLayerImages([]);
      setDrawings([]); // Clear drawings on logout
      currentSceneIdRef.current = null;
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      // Optionally, load a default public scene
        const publicScenesRes = await fetch('/api/public/scenes');
        if (publicScenesRes.ok) {
            const publicScenesData = await publicScenesRes.json();
            if (Array.isArray(publicScenesData) && publicScenesData.length > 0) {
                const initialPublicScene = findMostRecentScene(publicScenesData) || publicScenesData[0];
                if (initialPublicScene) await handleLoadScene(initialPublicScene);
            }
        }
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Logout Error", description: "Failed to log out.", variant: "destructive" });
    }
  };

  const handleDiceRoll = (sides: number, result: number, numberOfDice: number, individualRolls: number[]) => {
    if (!userRef.current) {
      toast({
        title: "Error",
        description: "You must be logged in to roll dice.",
        variant: "destructive",
      });
      return;
    }

    const rollsString = individualRolls.join(", ");
    const content = `rolled ${numberOfDice}d${sides} (Result: ${result}). Rolls: [${rollsString}]`;
    
    // Use userRef.current for the most up-to-date user information
    addMessage("diceRoll", content, userRef.current.username, "user");
  };

  const handlePhaseChange = (phase: string, color: string) => {/** ... */};
  const handleAddCharacter = async (category:string) => {};
  
  const handleUpdateCharacter = async (updatedCharacter: Character) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to update characters.", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(`/api/characters/${updatedCharacter.CharacterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCharacter),
      });

      if (response.ok) {
        const savedCharacter = await response.json();
        setCharacters((prevCharacters) =>
          prevCharacters.map((char) =>
            char.CharacterId === savedCharacter.CharacterId ? savedCharacter : char
          )
        );
        setCharacterSheetModal(savedCharacter);
        toast({ title: "Character Updated", description: `${savedCharacter.Name} has been updated.` });
      } else {
        const errorResult = await response.json().catch(() => ({ error: "Failed to update character." }));
        toast({ title: "Error Updating Character", description: errorResult.error || "Server error occurred.", variant: "destructive" });
        console.error("Failed to update character:", errorResult);
      }
    } catch (error) {
      console.error("Error updating character:", error);
      toast({ title: "Network Error", description: "Could not update character.", variant: "destructive" });
    }
  }; 
  
  const handleDeleteCharacter = async (characterToDelete: Character) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to delete characters.", variant: "destructive" });
      return;
    }
    // DM can delete any character, players potentially their own if logic allows (currently API doesn't specify player deletion)
    // For now, assuming only users who can see the delete button (typically DMs) can trigger this.

    console.log(`[Home.tsx] Attempting to delete character: ${characterToDelete.Name} (ID: ${characterToDelete.CharacterId}) by user ${user.username}`);

    try {
      const response = await fetch(`/api/characters/${characterToDelete.CharacterId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }, // Optional for DELETE with no body, but good practice
      });

      if (response.ok) {
        setCharacters((prevCharacters) =>
          prevCharacters.filter((char) => char.CharacterId !== characterToDelete.CharacterId)
        );
        // If the deleted character was open in the modal, close it
        if (characterSheetModal?.CharacterId === characterToDelete.CharacterId) {
          setCharacterSheetModal(null);
        }
        toast({ title: "Character Deleted", description: `${characterToDelete.Name} has been successfully deleted.` });
        
        // Potentially emit a socket event if other users need to be notified in real-time
        // For example: socketRef.current?.emit('character_deleted', characterToDelete.CharacterId);
        // The API endpoint should also emit a broader character_deleted or characters_updated event

      } else {
        const errorResult = await response.json().catch(() => ({ error: "Failed to delete character." }));
        toast({ title: "Error Deleting Character", description: errorResult.error || "Server error occurred.", variant: "destructive" });
        console.error("Failed to delete character (API response not OK):", errorResult);
      }
    } catch (error) {
      console.error("Network error trying to delete character:", error);
      toast({ title: "Network Error", description: "Could not connect to server to delete character.", variant: "destructive" });
    }
  };
  const handleAddImage = async (category: string, file: File) => {
    if (!user || user.role !== 'DM') {
      toast({ title: "Error", description: "Only DMs can upload images.", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    try {
      const response = await fetch('/api/images', {
        method: 'POST',
        body: formData,
        // No 'Content-Type' header for FormData, browser sets it with boundary
      });

      if (response.ok) {
        const newImage = await response.json();
        setImages((prevImages) => [...prevImages, newImage]);
        // Consider fetching all images again if more complex updates are needed elsewhere: await fetchImages();
        toast({ title: "Image Uploaded", description: `${newImage.Name} added to ${category}.` });
      } else {
        const errorResult = await response.json().catch(() => ({ error: "Failed to upload image." }));
        toast({ title: "Upload Error", description: errorResult.error || "Server error occurred.", variant: "destructive" });
        console.error("Failed to upload image:", errorResult);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({ title: "Network Error", description: "Could not upload image.", variant: "destructive" });
    }
  };
  const handleDeleteImage = async (image:DMImage) => {
    console.log("Attempting to delete image (Home.tsx):", image);
    try {
      const response = await fetch(`/api/images/${image.Id}`, { method: "DELETE" });
      if (response.ok) {
        setImages((prev) => prev.filter((i) => i.Id !== image.Id));
        toast({ title: "Success", description: "Image deleted successfully." });
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to delete image. Server response not OK."}));
        toast({ title: "Error Deleting Image", description: errorData.error || "Unknown server error.", variant: "destructive" });
        console.error("Error deleting image (API response not ok):", errorData);
      }
    } catch (error) {
      toast({ title: "Network Error", description: "Could not connect to server to delete image.", variant: "destructive" });
      console.error("Network error trying to delete image:", error);
    }
  };
  const handleRenameImage = async (image: DMImage, newName: string) => {
    if (!user || user.role !== 'DM') {
      toast({ title: "Permission Denied", description: "Only DMs can rename images.", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(`/api/images/${image.Id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });

      if (response.ok) {
        const updatedImage = await response.json();
        setImages((prev) => prev.map((img) => 
          img.Id === image.Id ? { ...img, Name: newName } : img
        ));
        toast({ title: "Success", description: "Image renamed successfully." });
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to rename image." }));
        toast({ title: "Error Renaming Image", description: errorData.error || "Unknown server error.", variant: "destructive" });
        console.error("Error renaming image (API response not ok):", errorData);
      }
    } catch (error) {
      toast({ title: "Network Error", description: "Could not connect to server to rename image.", variant: "destructive" });
      console.error("Network error trying to rename image:", error);
    }
  };
  const handleSetBackground = async (url:string) => { const sceneImage=images.find(img=>img.Link===url); await handleLoadScene(sceneImage||null);};
  const handleDropImage = (category:string,image:DMImage,x:number,y:number) => {};
  const handleUpdateImages = (middleLayer:LayerImage[],topLayer:LayerImage[]) => {
    setMiddleLayerImages(middleLayer);
    setTopLayerImages(topLayer);
    // Remove direct handleSaveScene call - let useEffect handle saves with proper Socket.IO flag checking
    // if (user?.role === 'DM') handleSaveScene();
  };
  const handleDeleteSceneData = async (image: DMImage) => {
    if (!user || user.role !== 'DM') {
      toast({ title: "Permission Denied", description: "Only DMs can clear scene data.", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: image.Id,
          sceneData: null
        })
      });

      if (!response.ok) {
        throw new Error("Failed to delete scene data");
      }

      // Update local state if this is the currently loaded scene
      if (selectedScene?.Id === image.Id) {
        setMiddleLayerImages([]);
        setTopLayerImages([]);
        setGridSize(50);
        setGridColor("rgba(0,0,0,0.1)");
        setSceneScale(1);
        setDrawings([]);
        setDarknessPaths([]);
        setIsDarknessLayerVisible(false);
        toast({ title: "Success", description: "Current scene data has been cleared." });
      } else {
        toast({ title: "Success", description: "Scene data deleted successfully." });
      }

      // Update the scenes and images state to reflect the change
      setScenes(prev => prev.map(s => 
        s.Id === image.Id 
          ? { ...s, SceneData: undefined } 
          : s
      ));

      setImages(prev => prev.map(img => 
        img.Id === image.Id 
          ? { ...img, SceneData: undefined } 
          : img
      ));

    } catch (error) {
      console.error("Error deleting scene data:", error);
      toast({ title: "Error", description: "Failed to delete scene data.", variant: "destructive" });
    }
  };

  const handleSaveScene = async () => {
    if (!selectedScene || !user || user.role !== 'DM') {
      // console.warn("Cannot save scene: No selected scene, user, or user is not DM.");
      return;
    }

    console.log(`Attempting to save scene: ${selectedScene.Id}`);

    const sceneDataToSave = {
      gridSize,
      gridColor,
      elements: {
        middleLayer: middleLayerImages,
        topLayer: topLayerImages,
      },
      scale: sceneScale,
      darknessPaths,
      isDarknessLayerVisible,
      savedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: selectedScene.Id,
          sceneData: sceneDataToSave,
        }),
      });

      if (response.ok) {
        const savedScene = await response.json();
        setSelectedScene(prev => prev ? { ...prev, SceneData: JSON.stringify(savedScene.SceneData || sceneDataToSave) } : null);
        setScenes(prevScenes => prevScenes.map(s => s.Id === savedScene.Id ? savedScene : s));
      } else {
        const errorResult = await response.json().catch(() => ({ error: "Failed to save scene." }));
        toast({ title: "Save Error", description: errorResult.error || "Failed to save scene data.", variant: "destructive" });
        console.error("Failed to save scene:", errorResult);
      }
    } catch (error) {
      toast({ title: "Network Error", description: "Could not save scene.", variant: "destructive" });
      console.error("Error saving scene:", error);
    }
  };

  const handleGridColorChangeAndSave = (color: string) => { 
    setGridColor(color); 
    if (user?.role === 'DM') handleSaveScene();
  };

  useEffect(() => { 
    console.log(`[Home.tsx useEffect Save Check] isInitialized: ${isInitialized}, user: ${user?.username}, role: ${user?.role}, isSocketUpdateRef: ${isSocketUpdateRef.current}`);
    console.log(`[Home.tsx useEffect Save Check] Dependencies:`, {
      middleLayerImages: middleLayerImages.length,
      topLayerImages: topLayerImages.length, 
      gridColor,
      sceneScale,
      darknessPaths: darknessPaths.length,
      isDarknessLayerVisible,
      selectedSceneId: selectedScene?.Id
    });
    if (isSocketUpdateRef.current) {
      console.log("[Home.tsx useEffect Save Check] Socket update detected, resetting flag and skipping save.");
      isSocketUpdateRef.current = false;
    } else if (isInitialized && user && user.role === 'DM') {
      console.log("[Home.tsx useEffect Save Check] User-initiated or non-socket change detected. Calling handleSaveScene.");
      handleSaveScene();
    }
  }, [middleLayerImages, topLayerImages, gridColor, sceneScale, darknessPaths, isDarknessLayerVisible, isInitialized, user, selectedScene?.Id]);
  
  const handleUpdateSceneScale = async (image: DMImage, scale: number) => {
    if (!user || user.role !== 'DM') {
      toast({ title: "Permission Denied", description: "Only DMs can update scene scale.", variant: "destructive" });
      return;
    }

    console.log(`[Home.tsx] Updating scene scale for scene ${image.Id} to ${scale}`);
    
    // Update local state immediately for responsive UI
    setSceneScale(scale);
    
    // Save will be triggered automatically by useEffect since sceneScale is in dependency array
    // The automatic save will include the new scale value
  };
  function handleClearTokens() {}
  
  const handleClearSceneElements = () => {
    if (user?.role !== 'DM') {
      toast({ title: "Permission Denied", description: "Only DMs can clear scene elements.", variant: "destructive" });
      return;
    }

    if (!selectedScene) {
      toast({ title: "No Scene Selected", description: "Please select a scene first.", variant: "default" });
      return;
    }

    if (middleLayerImages.length === 0 && topLayerImages.length === 0 && darknessPaths.length === 0) {
      toast({ title: "Scene Empty", description: "There are no tokens, images, or darkness on the current scene to clear.", variant: "default" });
      return;
    }

    if (window.confirm("Are you sure you want to clear all tokens, images, and darkness from the current scene? This cannot be undone.")) {
      console.log("Clearing scene elements (tokens, images, and darkness).");
      setMiddleLayerImages([]);
      setTopLayerImages([]);
      setDarknessPaths([]);
      setIsDarknessLayerVisible(false);
      if (user?.role === 'DM') handleSaveScene();
      toast({ title: "Scene Cleared", description: "All tokens, images, and darkness have been removed from the scene and changes are being saved." });
    }
  };

  const handleApiDrawingAdd = async (drawingData: NewDrawingData) => {
    if (!selectedScene?.Id || !user) { 
      toast({ title: "Error", description: "Cannot save drawing: No active scene or user.", variant: "destructive" }); 
      return; 
    }
    // The server currently expects id, path, color, createdBy, sceneId.
    // createdAt can be generated by the server or client.
    // For now, client will send what the server's validation check expects.
    const tempDrawingId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const drawingToSend = { 
      id: tempDrawingId, // Server currently expects an ID from client
      path: drawingData.path,
      color: drawingData.color,
      sceneId: selectedScene.Id,
      createdBy: user.id, // Server currently expects createdBy from client
      createdAt: new Date().toISOString() // Send createdAt as server might use it
    };

    try {
      const response = await fetch('/api/drawings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(drawingToSend)
      });

      if (response.ok) {
        const savedDrawing = await response.json();
        // Optimistically update the state with the server-confirmed drawing
        // The socket event will handle updates for other clients, and for this client,
        // the find check in the socket listener will prevent duplicates.
        setDrawings((prevDrawings) => {
          // Check if already added by socket (less likely now with optimistic update here)
          if (prevDrawings.find(d => d.id === savedDrawing.id)) {
            return prevDrawings.map(d => d.id === savedDrawing.id ? savedDrawing : d); // Update if exists
          }
          return [...prevDrawings, savedDrawing]; // Add if new
        });
        // toast({ title: "Drawing Saved", description: "Your drawing has been saved."}); // Optional success toast
      } else {
        const errorResult = await response.json().catch(() => ({ error: "Failed to save drawing." }));
        toast({ title: "Error", description: errorResult.error || "Failed to save drawing to server.", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error in handleApiDrawingAdd:', error);
      toast({ title: "Error", description: "Network error saving drawing.", variant: "destructive" });
    }
  };

  const handleApiDrawingsDelete = async (drawingIds: string[]) => {
    if (!user || !selectedScene?.Id) {
      console.warn("Cannot delete drawing: No user or selected scene.");
      return;
    }

    // Optimistic update: Remove drawings from local state immediately.
    setDrawings((prevDrawings) => prevDrawings.filter(d => !drawingIds.includes(d.id)));

    const sceneIdForBroadcast = selectedScene.Id;

    for (const drawingId of drawingIds) {
      try {
        const drawingToDelete = drawings.find(d => d.id === drawingId); // Get sceneId from local state for safety
        const currentSceneIdForDrawing = drawingToDelete?.sceneId || sceneIdForBroadcast;

        const response = await fetch(`/api/drawings?id=${drawingId}&sceneId=${currentSceneIdForDrawing}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          toast({ title: "Delete Error", description: `Failed to delete drawing ${drawingId.substring(0,8)}: ${errorData.error || response.statusText}`, variant: "destructive" });
          // If optimistic update was done, consider reverting for this specific ID or re-fetching.
        }
        // Successful delete will be broadcast by server via 'drawing_removed'
      } catch (error) { 
        console.error(`Error deleting drawing ${drawingId}:`, error); 
        toast({ title: "Network Error", description: `Failed to delete drawing ${drawingId.substring(0,8)}.`, variant: "destructive" }); 
      }
    }
  };
  
  // Placeholder functions for DrawingLayer (Canvas)
  const handleDrawingSelectFromLayer = (drawing: DrawingObject | null) => { setSelectedDrawing(drawing); };
  const handleDrawingDeleteFromLayer = async (drawing: DrawingObject) => { if (selectedScene?.Id) handleApiDrawingsDelete([drawing.id]); };
  const handleDrawingCompleteFromLayer = async (drawing: Omit<DrawingObject, 'id' | 'createdBy' | 'createdAt' | 'sceneId'>) => {
    // This needs to be compatible with NewDrawingData or handleApiDrawingAdd needs to be adjusted
    if (selectedScene?.Id) handleApiDrawingAdd(drawing as NewDrawingData);
  };

  const handlePlayerPlaceToken = async (tokenData: LayerImage, sceneId: number) => {
    if (!user || user.role !== 'player') {
      console.warn("[Home.tsx] handlePlayerPlaceToken called by non-player or no user.");
      return;
    }
    if (tokenData.character?.userId !== user.id) {
      console.warn("[Home.tsx] Player attempting to place a token that is not their own.");
      toast({ title: "Error", description: "You can only place your own character tokens.", variant: "destructive" });
      return;
    }
    console.log(`[Home.tsx] Player ${user.username} (ID: ${user.id}) attempting to save token for char ID: ${tokenData.characterId} on scene ${sceneId}. Token data:`, tokenData);

    try {
      const response = await fetch('/api/scenes/player-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId, tokenData }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({ title: "Token Saved", description: `Token ${result.tokenData?.character?.Name || 'Unknown'} placed successfully on the scene.` });
        // The socket event 'player_token_placed' from the API should handle updating other clients.
        // The current client already has an optimistic update from MainContent's onUpdateImages.
        // If we need to ensure the *saved* data from server is used, we could update here:
        // setTopLayerImages(prev => prev.map(t => t.id === result.tokenData.id ? result.tokenData : t));
      } else {
        const errorResult = await response.json().catch(() => ({ error: "Failed to save token placement." }));
        toast({ title: "Error Saving Token", description: errorResult.error || "Server error occurred.", variant: "destructive" });
        console.error("Failed to save player token:", errorResult);
        // Potentially revert optimistic update if needed, though complex.
      }
    } catch (error) {
      console.error("Error in handlePlayerPlaceToken API call:", error);
      toast({ title: "Network Error", description: "Could not save token placement.", variant: "destructive" });
    }
  };

  const handlePlayerRequestTokenDelete = async (tokenId: string) => {
    if (!user || user.role !== 'player') {
      console.warn("[Home.tsx] handlePlayerRequestTokenDelete called by non-player or no user.");
      return;
    }
    if (!selectedSceneRef.current?.Id) {
      toast({ title: "Error", description: "No active scene selected to delete token from.", variant: "destructive" });
      return;
    }
    const sceneId = selectedSceneRef.current.Id;

    console.log(`[Home.tsx] Player ${user.username} (ID: ${user.id}) requesting to delete token ID: ${tokenId} from scene ${sceneId}.`);

    // Note: Optimistic update is already handled in MainContent.tsx by modifying its local state
    // and calling onUpdateImages. Home.tsx will receive the updated topLayerImages.
    // This function is purely for the API call.

    try {
      const response = await fetch(`/api/scenes/player-token?sceneId=${sceneId}&tokenId=${tokenId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        // Server will emit 'scene_updated' which will refresh all clients' token lists.
        toast({ title: "Token Deletion Requested", description: `Your request to delete the token has been sent.` });
      } else {
        const errorResult = await response.json().catch(() => ({ error: "Failed to request token deletion." }));
        toast({ title: "Error Deleting Token", description: errorResult.error || "Server error occurred.", variant: "destructive" });
        console.error("Failed to delete player token:", errorResult);
        // Here, we might need to trigger a state refresh or revert the optimistic update if the API fails,
        // though that can be complex. For now, rely on 'scene_updated' for eventual consistency or error toast for user.
      }
    } catch (error) {
      console.error("Error in handlePlayerRequestTokenDelete API call:", error);
      toast({ title: "Network Error", description: "Could not request token deletion.", variant: "destructive" });
    }
  };

  const handlePlayerUpdateTokenPosition = async (tokenData: LayerImage, sceneId: number) => {
    if (!userRef.current || userRef.current.role !== 'player') {
      console.warn("[Home.tsx] handlePlayerUpdateTokenPosition called by non-player or no user.");
      return;
    }
    if (tokenData.character?.userId !== userRef.current.id) {
      console.warn("[Home.tsx] Player attempting to update position of a token that is not their own.");
      toast({ title: "Error", description: "You can only update your own character tokens.", variant: "destructive" });
      return;
    }
    if (!selectedSceneRef.current?.Id || selectedSceneRef.current.Id !== sceneId) {
      toast({ title: "Error", description: "Scene context mismatch for token update.", variant: "destructive" });
      return;
    }

    console.log(`[Home.tsx] Player ${userRef.current.username} updating token ID: ${tokenData.id} on scene ${sceneId}. New position: x=${tokenData.x}, y=${tokenData.y}`);

    try {
      const response = await fetch('/api/scenes/player-token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId, tokenData }), // Sending full tokenData for potential replacement/update logic on server
      });

      if (response.ok) {
        // Server will emit 'scene_updated' (or specific token_moved event) which will refresh clients.
        // toast({ title: "Token Moved", description: `Token position update sent.` }); // Optional toast
      } else {
        const errorResult = await response.json().catch(() => ({ error: "Failed to update token position." }));
        toast({ title: "Error Moving Token", description: errorResult.error || "Server error occurred.", variant: "destructive" });
        console.error("Failed to update player token position:", errorResult);
        // Consider reverting optimistic update if API fails - more complex
      }
    } catch (error) {
      console.error("Error in handlePlayerUpdateTokenPosition API call:", error);
      toast({ title: "Network Error", description: "Could not update token position.", variant: "destructive" });
    }
  };

  const handleMakeSceneActive = (sceneId: number) => {
    if (user?.role === 'DM' && socketRef.current?.connected) {
      console.log(`[Home.tsx DM] Emitting 'dm_set_active_scene' for scene ID: ${sceneId}`);
      socketRef.current.emit('dm_set_active_scene', sceneId);
      // Optionally, DM loads this scene too. For now, let player 'force_scene_change' handle DM if needed.
      // const sceneToLoad = scenes.find(s => s.Id === sceneId);
      // if (sceneToLoad && selectedScene?.Id !== sceneId) {
      //   handleLoadScene(sceneToLoad);
      // }
    }
  };

  const handleOpenCharacterSheet = (characterData: Character) => {
    setCharacterSheetModal(characterData);
  };

  const handleCloseCharacterSheet = () => {
    setCharacterSheetModal(null);
  };

  // Darkness layer handler
  const handleDarknessChange = useCallback((paths: DarknessPath[]) => {
    console.log('[Home.tsx] Darkness paths updated:', paths);
    setDarknessPaths(paths);
    // Scene will be automatically saved due to useEffect dependency
  }, []);

  // Darkness layer visibility handler
  const handleToggleDarknessLayer = useCallback(() => {
    setIsDarknessLayerVisible(prev => {
      const newValue = !prev;
      // Remove direct handleSaveScene call - let useEffect handle saves with proper Socket.IO flag checking
      // if (user?.role === 'DM') {
      //   // Use setTimeout to save after state update
      //   setTimeout(() => {
      //     handleSaveScene();
      //   }, 0);
      // }
      return newValue;
    });
  }, [user?.role]);

  // Effect to log characters state when it actually changes
  useEffect(() => {
    if (isInitialized) { 
    }
  }, [characters, isInitialized]);

  const handleImageUploaded = (uploadedImage: any) => {
    // Add the uploaded image to the images list
    setImages((prevImages) => [...prevImages, uploadedImage]);
  };

  if (isLoading || !isInitialized) { return <div className="flex items-center justify-center min-h-screen">Loading...</div> }

  if (!user) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex-grow">
          <MainContent
            backgroundImage={backgroundImage} middleLayerImages={middleLayerImages} topLayerImages={topLayerImages}
            onUpdateImages={handleUpdateImages} gridSize={gridSize} gridColor={gridColor}
            onGridSizeChange={setGridSize} onGridColorChange={setGridColor}
            currentTool="cursor" onToolChange={() => {}} currentColor="#000000" onColorChange={() => {}}
            sceneScale={sceneScale} zoomLevel={zoomLevel} setZoomLevel={setZoomLevel}
            currentSceneId={selectedScene?.Id} currentUserId={null} currentUserRole={null}
            drawings={drawings} 
            onDrawingAdd={(_data: NewDrawingData) => { toast({ title: "Login Required", description: "Please log in to draw.", variant: "destructive" }); }}
            onDrawingsDelete={(_ids: string[]) => { toast({ title: "Login Required", description: "Please log in to delete drawings.", variant: "destructive" }); }}
            onAddImage={async (_category: string, _file: File) => { toast({ title: "Login Required", description: "Please log in to upload images.", variant: "destructive" }); }}
            onImageUploaded={handleImageUploaded}
            darknessPaths={[]}
            onDarknessChange={() => {}}
            isDarknessLayerVisible={false}
            onToggleDarknessLayer={() => {}}
          />
        </div>
        <div className="absolute top-4 right-4 z-50">
          <div className="bg-white/90 backdrop-blur p-8 rounded-lg shadow-md max-w-md">
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="login">Login</TabsTrigger><TabsTrigger value="register">Register</TabsTrigger></TabsList>
              <TabsContent value="login"><LoginForm onLogin={handleLogin} /></TabsContent>
              <TabsContent value="register"><RegisterForm onRegister={handleLogin} /></TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen">
        <div className="flex flex-grow overflow-hidden">
          <div className="flex-grow overflow-hidden">
            <MainContent
              backgroundImage={backgroundImage} middleLayerImages={middleLayerImages} topLayerImages={topLayerImages}
              onUpdateImages={handleUpdateImages} gridSize={gridSize} gridColor={gridColor}
              onGridSizeChange={setGridSize} onGridColorChange={handleGridColorChangeAndSave}
              currentTool={currentTool} onToolChange={setCurrentTool} currentColor={currentColor} onColorChange={setCurrentColor}
              sceneScale={sceneScale} zoomLevel={zoomLevel} setZoomLevel={setZoomLevel}
              currentSceneId={selectedScene?.Id} currentUserId={user?.id} currentUserRole={user?.role}
              drawings={drawings} 
              onDrawingAdd={handleApiDrawingAdd}
              onDrawingsDelete={handleApiDrawingsDelete} 
              onPlayerPlaceToken={handlePlayerPlaceToken}
              onPlayerRequestTokenDelete={handlePlayerRequestTokenDelete}
              onPlayerUpdateTokenPosition={handlePlayerUpdateTokenPosition}
              onOpenCharacterSheet={handleOpenCharacterSheet}
              onAddImage={handleAddImage}
              onImageUploaded={handleImageUploaded}
              darknessPaths={darknessPaths}
              onDarknessChange={handleDarknessChange}
              isDarknessLayerVisible={isDarknessLayerVisible}
              onToggleDarknessLayer={handleToggleDarknessLayer}
            />
          </div>
          <RightSideMenu
            messages={messages} addMessage={addMessage} user={user} chatBackgroundColor={chatBackgroundColor}
            characters={characters} onAddCharacter={handleAddCharacter} onUpdateCharacter={handleUpdateCharacter} onDeleteCharacter={handleDeleteCharacter}
            onLogout={handleLogout} images={images} onAddImage={handleAddImage} onDeleteImage={handleDeleteImage}
            onRenameImage={handleRenameImage} onSetBackground={handleSetBackground} onDropImage={handleDropImage}
            scenes={scenes} onLoadScene={handleLoadScene}
            onDeleteSceneData={handleDeleteSceneData} onUpdateSceneScale={handleUpdateSceneScale} setImages={setImages}
            onClearSceneElements={handleClearSceneElements}
            onMakeSceneActive={handleMakeSceneActive}
            activeTab={activeRightMenuTab}
            setActiveTab={setActiveRightMenuTab}
            allUsers={allUsers}
          />
        </div>
        <BottomBar onDiceRoll={handleDiceRoll} onPhaseChange={handlePhaseChange} userRole={user.role} />
      </div>
      <div className="relative w-full h-full pointer-events-none hidden"> 
        <DrawingLayer
          isDrawingMode={false} 
          currentColor={currentColor}
          currentTool={currentTool} 
          drawings={drawings} 
          onDrawingComplete={handleDrawingCompleteFromLayer} 
          onDrawingSelect={handleDrawingSelectFromLayer}
          onDrawingDelete={handleDrawingDeleteFromLayer} 
          selectedDrawing={selectedDrawing}
          currentSceneId={selectedScene?.Id}
        />
      </div>
      {characterSheetModal && (
        <CharacterPopup 
          key={characterSheetModal.CharacterId}
          character={characterSheetModal} 
          onClose={handleCloseCharacterSheet} 
          onUpdate={handleUpdateCharacter} 
          isDM={user.role === 'DM'}
          allUsers={user.role === 'DM' ? allUsers : undefined}
        />
      )}
    </ErrorBoundary>
  )
}
