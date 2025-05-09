"use client"

import { useState, useEffect, useRef } from "react";
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

// Define NewDrawingData here for now, ensure MainContent can import it or define its own.
export type NewDrawingData = Omit<DrawingObject, 'id' | 'createdAt' | 'createdBy' | 'sceneId'>;


export type MessageType = "user" | "system";

export interface ChatMessage {
  MessageId?: number;
  type: MessageType;
  content: string;
  timestamp: string;
  username: string;
  UserId?: number;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
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
  const [currentTool, setCurrentTool] = useState<'brush' | 'cursor'>('cursor');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [drawings, setDrawings] = useState<DrawingObject[]>([]);
  const [selectedDrawing, setSelectedDrawing] = useState<DrawingObject | null>(null);
  const [sceneScale, setSceneScale] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const socketRef = useRef<Socket | null>(null);
  const currentSceneIdRef: React.MutableRefObject<number | null> = useRef<number | null>(null);

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
      setSelectedScene(null); setBackgroundImage("");
      setMiddleLayerImages([]); setTopLayerImages([]); setDrawings([]);
      currentSceneIdRef.current = null;
      if (socketRef.current && socketRef.current.connected && currentSceneIdRef.current) {
          if (currentSceneIdRef.current !== null) {
            socketRef.current.emit('leave_scene', currentSceneIdRef.current !== null ? currentSceneIdRef.toString() : "");
          }
      }
      return;
    }
    setSelectedScene(scene); setBackgroundImage(scene.Link);
    currentSceneIdRef.current = scene.Id;
    if (scene.SceneData) {
      try {
        const sceneData = JSON.parse(scene.SceneData);
        setGridSize(sceneData.gridSize || 50); setGridColor(sceneData.gridColor || "rgba(0,0,0,0.1)");
        setMiddleLayerImages(sceneData.elements?.middleLayer || []); setTopLayerImages(sceneData.elements?.topLayer || []);
        setSceneScale(sceneData.scale || 1);
      } catch (error) {
        console.error("Error loading scene data:", error);
        toast({ title: "Error", description: "Failed to parse scene data.", variant: "destructive" });
        setMiddleLayerImages([]); setTopLayerImages([]);
      }
    } else {
      setGridSize(50); setGridColor("rgba(0,0,0,0.1)");
      setMiddleLayerImages([]); setTopLayerImages([]); setSceneScale(1);
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
            fetch(`/api/characters`, { credentials: "include" }).then(res => res.ok ? res.json() : []),
            fetch("/api/chat", { credentials: "include" }).then(res => res.ok ? res.json() : []),
            fetch("/api/scenes", { credentials: "include" }).then(res => res.ok ? res.json() : [])
          ]);
          setCharacters(characterData);
          setMessages(chatData.map((msg: any) => ({ MessageId: msg.MessageId, type: msg.Type as MessageType, content: msg.Content, timestamp: msg.Timestamp, username: msg.Username, UserId: msg.UserId })));
          setScenes(userScenesData);
          if (userData.role === "DM") await fetchImages();
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
      console.log('Socket.IO: drawing_added received', newDrawing);
      if (String(newDrawing.sceneId) === String(currentSceneIdRef.current)) {
        setDrawings((prev) => prev.find(d => d.id === newDrawing.id) ? prev : [...prev, newDrawing]);
      }
    });
    socket.on('drawing_removed', (drawingId: string, sceneId: number) => {
      console.log('Socket.IO: drawing_removed received', drawingId, sceneId);
      if (String(sceneId) === String(currentSceneIdRef.current)) {
        setDrawings((prev) => prev.filter(d => d.id !== drawingId));
      }
    });
    return () => { if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; } };
  }, []); 

  useEffect(() => {
    const socket = socketRef.current;
    const newSceneId = selectedScene?.Id;
    const oldSceneId = currentSceneIdRef.current;
    if (socket && socket.connected) {
      if (oldSceneId && oldSceneId !== newSceneId) { socket.emit('leave_scene', String(oldSceneId)); }
      if (newSceneId && newSceneId !== oldSceneId) { socket.emit('join_scene', String(newSceneId)); }
    }
    currentSceneIdRef.current = newSceneId ?? null;
  }, [selectedScene?.Id]);

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
        setMessages(data.map((msg: any) => ({ MessageId: msg.MessageId, type: msg.Type as MessageType, content: msg.Content, timestamp: msg.Timestamp, username: msg.Username, UserId: msg.UserId })));
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

  const loadUserData = async (loggedInUser: User) => {
    setUser(loggedInUser); // Set user state first
    await Promise.all([
      fetchCharacters(),
      fetchChatMessages(),
      fetchScenes(),
      loggedInUser.role === "DM" ? fetchImages() : Promise.resolve(),
    ]);
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

  const addMessage = async (type:MessageType,content:string,username:string) => {};
  const handleDiceRoll = (sides:number,result:number,numberOfDice:number,individualRolls:number[]) => {};
  const handlePhaseChange = (phase:string,color:string) => {}; const handleAddCharacter = async (category:string) => {};
  const handleUpdateCharacter = async (updatedCharacter:Character) => {}; const handleDeleteCharacter = async (character:Character) => {};
  const handleAddImage = async (category:string,file:File) => {};
  const handleDeleteImage = async (image:DMImage) => {}; const handleRenameImage = async (image:DMImage,newName:string) => {};
  const handleSetBackground = async (url:string) => { const sceneImage=images.find(img=>img.Link===url); await handleLoadScene(sceneImage||null);};
  const handleDropImage = (category:string,image:DMImage,x:number,y:number) => {};
  const handleUpdateImages = (middleLayer:LayerImage[],topLayer:LayerImage[]) => {setMiddleLayerImages(middleLayer); setTopLayerImages(topLayer);};
  const handleSaveScene = async () => {}; const handleDeleteSceneData = async (image:DMImage) => {};
  const handleGridColorChangeAndSave = (color: string) => { setGridColor(color); };
  useEffect(() => { if(isInitialized && user) handleSaveScene(); }, [gridColor, middleLayerImages, topLayerImages, sceneScale, isInitialized, user]);
  const handleUpdateSceneScale = async (image: DMImage, scale: number) => {};
  function handleClearTokens() {}
  
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
    const sceneIdForBroadcast = selectedScene.Id;

    // Optimistic update can be done here, but for simplicity,
    // we'll rely on the server broadcast 'drawing_removed' to update the state.
    // setDrawings(prevDrawings => prevDrawings.filter(d => !drawingIds.includes(d.id)));

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
            />
          </div>
          <RightSideMenu
            messages={messages} addMessage={addMessage} user={user} chatBackgroundColor={chatBackgroundColor}
            characters={characters} onAddCharacter={handleAddCharacter} onUpdateCharacter={handleUpdateCharacter} onDeleteCharacter={handleDeleteCharacter}
            onLogout={handleLogout} images={images} onAddImage={handleAddImage} onDeleteImage={handleDeleteImage}
            onRenameImage={handleRenameImage} onSetBackground={handleSetBackground} onDropImage={handleDropImage}
            scenes={scenes} onSaveScene={handleSaveScene} onLoadScene={handleLoadScene}
            onDeleteSceneData={handleDeleteSceneData} onUpdateSceneScale={handleUpdateSceneScale} setImages={setImages}
          />
        </div>
        <BottomBar onDiceRoll={handleDiceRoll} onPhaseChange={handlePhaseChange} />
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
    </ErrorBoundary>
  )
}
