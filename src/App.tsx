/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, db 
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { 
  Layout, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Clock, 
  Brain, 
  BarChart3, 
  ShieldCheck, 
  MessageSquare, 
  User as UserIcon,
  LogOut,
  Bell,
  Zap,
  BookOpen,
  Trophy,
  ChevronRight,
  Timer,
  AlertTriangle,
  Mic,
  Send,
  Calendar,
  MicOff,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { format } from 'date-fns';
import { getAIResponse, getAIVoiceResponse } from './services/geminiService';
import { UserProfile, Task, StudySession, PriorityLevel } from './types';

// --- Components ---

const FuturisticCard = ({ children, title, icon: Icon, className = "" }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white/80 backdrop-blur-md border border-blue-100 rounded-3xl p-6 shadow-xl shadow-blue-500/5 ${className}`}
  >
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-blue-500" />}
        {title}
      </h3>
      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
    </div>
    {children}
  </motion.div>
);

const DEFAULT_PRIORITIES: PriorityLevel[] = [
  { id: 'low', label: 'Low', color: 'text-blue-500' },
  { id: 'medium', label: 'Medium', color: 'text-amber-500' },
  { id: 'high', label: 'High', color: 'text-red-500' },
];

const PRIORITY_COLORS = [
  { name: 'Blue', class: 'text-blue-500' },
  { name: 'Amber', class: 'text-amber-500' },
  { name: 'Red', class: 'text-red-500' },
  { name: 'Emerald', class: 'text-emerald-500' },
  { name: 'Violet', class: 'text-violet-500' },
  { name: 'Pink', class: 'text-pink-500' },
  { name: 'Cyan', class: 'text-cyan-500' },
];

const ProgressBar = ({ progress, color = "bg-blue-500" }: { progress: number, color?: string }) => (
  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      className={`h-full ${color}`}
    />
  </div>
);

const FormulaCard = ({ name, formula, description }: { name: string, formula: string, description: string }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className="relative h-48 w-full perspective-1000 cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="w-full h-full relative transition-all duration-500 preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden bg-white border border-blue-100 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-lg">
          <h4 className="text-sm font-bold text-blue-500 uppercase tracking-wider mb-2">{name}</h4>
          <p className="text-xl font-black text-slate-800 font-mono">{formula}</p>
          <p className="text-[10px] text-slate-400 mt-4 uppercase font-bold">Tap to see details</p>
        </div>
        
        {/* Back */}
        <div 
          className="absolute inset-0 backface-hidden bg-blue-600 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-lg text-white"
          style={{ transform: 'rotateY(180deg)' }}
        >
          <h4 className="text-sm font-bold uppercase tracking-wider mb-2">Application</h4>
          <p className="text-sm font-medium leading-relaxed">{description}</p>
          <p className="text-[10px] opacity-60 mt-4 uppercase font-bold">Tap to flip back</p>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Task Creation Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    category: 'Study',
    priority: 'Medium',
    startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    endDate: format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm"),
    reminderTime: ''
  });

  // Pomodoro State
  const [timerMode, setTimerMode] = useState<'study' | 'break'>('study');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<any>(null);

  // AI Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: string, parts: { text: string }[] }[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [instagramBlockedUntil, setInstagramBlockedUntil] = useState<string | null>(null);
  const [newPriority, setNewPriority] = useState({ label: '', color: 'text-blue-500' });
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const recognitionRef = useRef<any>(null);
  const [chatEndRef] = [useRef<HTMLDivElement>(null)];

  // Quotes State
  const quotes = [
    "The only way to do great work is to love what you do.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "Believe you can and you're halfway there.",
    "Your time is limited, don't waste it living someone else's life.",
    "The future belongs to those who believe in the beauty of their dreams.",
    "Hardships often prepare ordinary people for an extraordinary destiny.",
    "It does not matter how slowly you go as long as you do not stop.",
    "Everything you've ever wanted is on the other side of fear.",
    "Success usually comes to those who are too busy to be looking for it.",
    "Don't watch the clock; do what it does. Keep going."
  ];
  const [currentQuote, setCurrentQuote] = useState(quotes[Math.floor(Math.random() * quotes.length)]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const kaizenTips = [
    "Organize your study desk for 2 minutes before starting.",
    "Review one difficult concept from yesterday for 5 minutes.",
    "Write down three specific goals for today's study session.",
    "Practice active recall by explaining a topic to an imaginary friend.",
    "Take a 5-minute walk after every 50 minutes of focused study.",
    "Drink a glass of water before starting your next task.",
    "Summarize your learning in one sentence at the end of the day.",
    "Turn off all notifications for the next 25 minutes.",
    "Read one page of a technical book outside your current syllabus.",
    "Reflect on one thing you did well today and one thing to improve tomorrow."
  ];

  const formulaData = [
    {
      subject: "Engineering Mathematics",
      formulas: [
        { name: "Euler's Formula", formula: "e^(iθ) = cos(θ) + i sin(θ)", description: "Relates complex exponentials to trigonometric functions." },
        { name: "Quadratic Formula", formula: "x = [-b ± √(b² - 4ac)] / 2a", description: "Solutions for ax² + bx + c = 0." },
        { name: "Integration by Parts", formula: "∫u dv = uv - ∫v du", description: "Technique for integrating products of functions." }
      ]
    },
    {
      subject: "Digital Electronics",
      formulas: [
        { name: "De Morgan's Theorem 1", formula: "NOT (A AND B) = (NOT A) OR (NOT B)", description: "Simplifying Boolean expressions." },
        { name: "De Morgan's Theorem 2", formula: "NOT (A OR B) = (NOT A) AND (NOT B)", description: "Complement of a sum is product of complements." },
        { name: "Boolean Identity", formula: "A + AB = A", description: "Absorption law in Boolean algebra." }
      ]
    },
    {
      subject: "C Programming",
      formulas: [
        { name: "Pointer Declaration", formula: "int *ptr;", description: "Declaring a pointer to an integer." },
        { name: "Memory Allocation", formula: "ptr = (int*)malloc(n * sizeof(int));", description: "Dynamic memory allocation in C." },
        { name: "String Length", formula: "strlen(str);", description: "Function to find the length of a string." }
      ]
    }
  ];

  const speakQuote = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const { GoogleGenAI, Modality } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say inspiringly: ${currentQuote}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const int16Data = new Int16Array(bytes.buffer);
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
          float32Data[i] = int16Data[i] / 32768.0;
        }

        const audioBuffer = audioContext.createBuffer(1, float32Data.length, 24000);
        audioBuffer.getChannelData(0).set(float32Data);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => {
          setIsSpeaking(false);
          audioContext.close();
        };
        source.start();
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("TTS Error:", error);
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    }, 300000); // New quote every 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Punishment Logic
  const pendingTasksCount = tasks.filter(t => !t.completed).length;
  const isPunishmentActive = pendingTasksCount > 5;

  useEffect(() => {
    const checkPenalties = async () => {
      if (!user || tasks.length === 0) return;
      
      const now = new Date();
      let highestPenaltyTime: Date | null = null;

      for (const task of tasks) {
        if (!task.completed && new Date(task.endDate) < now) {
          // Task is overdue and not completed
          const penaltyTime = new Date(new Date(task.endDate).getTime() + 3 * 60 * 60 * 1000);
          if (!highestPenaltyTime || penaltyTime > highestPenaltyTime) {
            highestPenaltyTime = penaltyTime;
          }
          
          if (!task.penaltyApplied) {
            await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
              penaltyApplied: true,
              penaltyExpiresAt: penaltyTime.toISOString()
            });
          }
        }
      }

      if (highestPenaltyTime && highestPenaltyTime > now) {
        setInstagramBlockedUntil(highestPenaltyTime.toISOString());
      } else {
        setInstagramBlockedUntil(null);
      }
    };

    const interval = setInterval(checkPenalties, 60000); // Check every minute
    checkPenalties();
    return () => clearInterval(interval);
  }, [tasks, user]);

  useEffect(() => {
    const checkReminders = async () => {
      if (!user || tasks.length === 0) return;
      
      const now = new Date();
      for (const task of tasks) {
        if (!task.completed && task.reminderTime && !task.reminderTriggered) {
          const reminderDate = new Date(task.reminderTime);
          if (reminderDate <= now) {
            // Trigger reminder
            alert(`REMINDER: ${task.title} is due soon!`);
            
            // Mark as triggered in Firestore
            await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
              reminderTriggered: true
            });
          }
        }
      }
    };

    const interval = setInterval(checkReminders, 30000); // Check every 30 seconds
    checkReminders();
    return () => clearInterval(interval);
  }, [tasks, user]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch or create profile
        const profileRef = doc(db, 'users', currentUser.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          setProfile(profileSnap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Student',
            email: currentUser.email || '',
            photoURL: currentUser.photoURL || '',
            disciplineScore: 85,
            studyGoal: '90%+ in Diploma CSE',
            dailyTargetMinutes: 180,
            badges: ['New Recruit'],
            createdAt: new Date().toISOString()
          };
          await setDoc(profileRef, newProfile);
          setProfile(newProfile);
        }

        // Listen for tasks
        const tasksQuery = query(collection(db, 'users', currentUser.uid, 'tasks'), orderBy('createdAt', 'desc'));
        const unsubTasks = onSnapshot(tasksQuery, (snap) => {
          setTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
        });

        // Listen for sessions
        const sessionsQuery = query(collection(db, 'users', currentUser.uid, 'studySessions'), orderBy('timestamp', 'desc'));
        const unsubSessions = onSnapshot(sessionsQuery, (snap) => {
          setSessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudySession)));
        });

        setLoading(false);
        return () => {
          unsubTasks();
          unsubSessions();
        };
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Timer Logic
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimerComplete();
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning, timeLeft]);

  // Notifications
  useEffect(() => {
    if (user && tasks.length > 0) {
      const interval = setInterval(() => {
        const now = new Date();
        if (now.getHours() === 8 && now.getMinutes() === 0) {
          alert("Good morning! Today's focus: Engineering Mathematics.");
        }
        if (now.getHours() === 21 && now.getMinutes() === 0) {
          const completed = tasks.filter(t => t.completed).length;
          const total = tasks.length;
          const percent = Math.round((completed / total) * 100);
          alert(`You completed ${percent}% of tasks. Finish the remaining tasks.`);
        }
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [user, tasks]);

  // Voice Assistant Logic
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        handleVoiceCommand(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        if (isVoiceMode) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Recognition already started or error", e);
          }
        } else {
          setIsListening(false);
        }
      };
    }
  }, [isVoiceMode]);

  const toggleVoiceMode = () => {
    if (!isVoiceMode) {
      setIsVoiceMode(true);
      setIsListening(true);
      recognitionRef.current?.start();
      speak("Voice assistant study mode activated. How can I help you today?");
    } else {
      setIsVoiceMode(false);
      setIsListening(false);
      recognitionRef.current?.stop();
      setVoiceStatus('');
    }
  };

  const speak = async (text: string) => {
    setVoiceStatus("Speaking...");
    try {
      const audio = await getAIVoiceResponse(text);
      if (audio) {
        const audioObj = new Audio(`data:audio/mp3;base64,${audio}`);
        audioObj.play();
      }
    } catch (e) {
      console.error("Speech error", e);
    }
  };

  const handleVoiceCommand = async (command: string) => {
    setVoiceStatus(`Heard: "${command}"`);
    
    if (command.includes('start study') || command.includes('start focus') || command.includes('start timer')) {
      setIsTimerRunning(true);
      speak("Starting your focus session. Good luck!");
    } else if (command.includes('stop timer') || command.includes('stop study')) {
      setIsTimerRunning(false);
      speak("Timer stopped.");
    } else if (command.includes('go to tasks')) {
      setActiveTab('tasks');
      speak("Switching to your tasks.");
    } else if (command.includes('go to dashboard')) {
      setActiveTab('dashboard');
      speak("Going to dashboard.");
    } else if (command.includes('go to timer')) {
      setActiveTab('timer');
      speak("Opening the study timer.");
    } else if (command.includes('go to chat')) {
      setActiveTab('chat');
      speak("Opening AI tutor chat.");
    } else if (command.includes('add task')) {
      const title = command.replace('add task', '').trim();
      if (title) {
        setNewTask(prev => ({ ...prev, title }));
        setIsTaskModalOpen(true);
        speak(`I've set the title to ${title}. Please confirm the details.`);
      } else {
        speak("What is the title of the task?");
      }
    } else if (command.includes('ask ai') || command.includes('hey ai') || command.includes('tell me about')) {
      const query = command.replace('ask ai', '').replace('hey ai', '').trim();
      if (query) {
        setVoiceStatus("AI is thinking...");
        const response = await getAIResponse(query);
        speak(response);
      }
    } else if (command.includes('what are my tasks')) {
      const pendingTasks = tasks.filter(t => !t.completed);
      if (pendingTasks.length > 0) {
        speak(`You have ${pendingTasks.length} pending tasks. The first one is ${pendingTasks[0].title}.`);
      } else {
        speak("You have no pending tasks. Great job!");
      }
    } else {
      if (command.split(' ').length > 3) {
        setVoiceStatus("Processing query...");
        const response = await getAIResponse(command);
        speak(response);
      }
    }
  };

  const handleTimerComplete = async () => {
    setIsTimerRunning(false);
    if (timerMode === 'study') {
      // Record session
      if (user) {
        await addDoc(collection(db, 'users', user.uid, 'studySessions'), {
          userId: user.uid,
          subject: 'General Study',
          durationMinutes: 25,
          mode: 'Deep Study',
          timestamp: new Date().toISOString()
        });
        // Update discipline score
        const profileRef = doc(db, 'users', user.uid);
        await updateDoc(profileRef, {
          disciplineScore: Math.min(100, (profile?.disciplineScore || 85) + 2)
        });
      }
      alert('Focus session complete! Take a break.');
      setTimerMode('break');
      setTimeLeft(5 * 60);
    } else {
      alert('Break over! Ready to focus?');
      setTimerMode('study');
      setTimeLeft(25 * 60);
    }
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = () => signOut(auth);

  const addTask = async () => {
    if (!user || !newTask.title) return;
    await addDoc(collection(db, 'users', user.uid, 'tasks'), {
      userId: user.uid,
      title: newTask.title,
      category: newTask.category,
      priority: newTask.priority,
      startDate: new Date(newTask.startDate).toISOString(),
      endDate: new Date(newTask.endDate).toISOString(),
      reminderTime: newTask.reminderTime ? new Date(newTask.reminderTime).toISOString() : null,
      completed: false,
      createdAt: new Date().toISOString(),
      penaltyApplied: false,
      reminderTriggered: false
    });
    setIsTaskModalOpen(false);
    setNewTask({
      title: '',
      category: 'Study',
      priority: 'Medium',
      startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm"),
      reminderTime: ''
    });
  };

  const toggleTask = async (task: Task) => {
    if (!user) return;
    
    if (!task.completed) {
      setTaskToComplete(task);
      setIsConfirmModalOpen(true);
    } else {
      const taskRef = doc(db, 'users', user.uid, 'tasks', task.id);
      await updateDoc(taskRef, { completed: false });
    }
  };

  const confirmToggleTask = async () => {
    if (!user || !taskToComplete) return;
    const taskRef = doc(db, 'users', user.uid, 'tasks', taskToComplete.id);
    await updateDoc(taskRef, { completed: true });
    setIsConfirmModalOpen(false);
    setTaskToComplete(null);
  };

  const deleteTask = async (taskId: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'tasks', taskId));
  };

  const addCustomPriority = async () => {
    if (!newPriority.label || !user) return;
    const currentPriorities = profile?.customPriorities || DEFAULT_PRIORITIES;
    const updatedPriorities = [...currentPriorities, {
      id: Date.now().toString(),
      label: newPriority.label,
      color: newPriority.color
    }];
    await updateDoc(doc(db, 'users', user.uid), {
      customPriorities: updatedPriorities
    });
    setNewPriority({ label: '', color: 'text-blue-500' });
  };

  const deleteCustomPriority = async (priorityId: string) => {
    if (!user || !profile?.customPriorities) return;
    const updatedPriorities = profile.customPriorities.filter(p => p.id !== priorityId);
    await updateDoc(doc(db, 'users', user.uid), {
      customPriorities: updatedPriorities
    });
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user', parts: [{ text: chatInput }] };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsAiLoading(true);

    try {
      const response = await getAIResponse(chatInput, chatHistory);
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: response }] }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="w-6 h-6 text-blue-500 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8"
        >
          <div className="w-24 h-24 bg-blue-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40 mb-6 mx-auto">
            <ShieldCheck className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">STUDY COMMAND</h1>
          <p className="text-slate-500 font-medium">AI Student Task Manager • JARVIS Edition</p>
        </motion.div>
        
        <div className="max-w-md w-full space-y-4">
          <button 
            onClick={login}
            className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>
          <p className="text-xs text-slate-400">By logging in, you agree to our Terms of Service</p>
        </div>
      </div>
    );
  }

  const chartData = [
    { name: 'Mon', study: 120, target: 180 },
    { name: 'Tue', study: 150, target: 180 },
    { name: 'Wed', study: 200, target: 180 },
    { name: 'Thu', study: 90, target: 180 },
    { name: 'Fri', study: 180, target: 180 },
    { name: 'Sat', study: 240, target: 180 },
    { name: 'Sun', study: 160, target: 180 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-bottom border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">STUDY COMMAND</h2>
            <p className="text-[10px] text-blue-500 font-bold tracking-widest uppercase">System Online</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative p-2 text-slate-400 hover:text-blue-500 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>
          <img 
            src={profile?.photoURL || 'https://picsum.photos/seed/student/100/100'} 
            className="w-10 h-10 rounded-xl border-2 border-blue-100"
            alt="Profile"
          />
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {activeTab === 'dashboard' && (
          <>
            {isPunishmentActive && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-500 text-white p-6 rounded-3xl shadow-2xl shadow-red-500/40 flex items-center gap-4"
              >
                <AlertTriangle className="w-10 h-10 shrink-0" />
                <div>
                  <h3 className="font-black text-lg">PUNISHMENT MODE ACTIVE</h3>
                  <p className="text-sm opacity-90">You have {pendingTasksCount} pending tasks. System access restricted until tasks are cleared.</p>
                </div>
              </motion.div>
            )}
            {instagramBlockedUntil && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-orange-500 text-white p-6 rounded-3xl shadow-2xl shadow-orange-500/40 flex items-center gap-4"
              >
                <ShieldCheck className="w-10 h-10 shrink-0" />
                <div>
                  <h3 className="font-black text-lg">INSTAGRAM BLOCKED</h3>
                  <p className="text-sm opacity-90">
                    Penalty active for uncompleted tasks. Instagram access restricted until {format(new Date(instagramBlockedUntil), 'h:mm a')}.
                  </p>
                </div>
              </motion.div>
            )}
            {/* Welcome Section */}
            <section className="space-y-1">
              <h1 className="text-2xl font-black text-slate-900">Welcome, {profile?.displayName?.split(' ')[0]}</h1>
              <p className="text-slate-500 text-sm italic">"Consistency beats talent. One focused hour is better than three distracted hours."</p>
            </section>

            {/* Kaizen Section */}
            <FuturisticCard title="Kaizen Daily Improvement" icon={Zap} className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-none">
              <div className="space-y-3">
                <p className="text-sm font-medium opacity-90">
                  Today's 1% improvement:
                </p>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                  <p className="text-sm font-bold italic">
                    {kaizenTips[Math.floor(new Date().getDate() % kaizenTips.length)]}
                  </p>
                </div>
                <button className="w-full py-2 bg-white text-blue-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-50 transition-colors">
                  Mark as Completed
                </button>
              </div>
            </FuturisticCard>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <FuturisticCard title="Discipline" icon={ShieldCheck}>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-black text-blue-600">{profile?.disciplineScore}</span>
                  <span className="text-slate-400 text-xs font-bold mb-1">/ 100</span>
                </div>
                <ProgressBar progress={profile?.disciplineScore || 0} color="bg-blue-500" />
              </FuturisticCard>
              <FuturisticCard title="Study Goal" icon={Trophy}>
                <p className="text-xs font-bold text-slate-600 mb-2">{profile?.studyGoal}</p>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">7 Day Streak</span>
                </div>
              </FuturisticCard>
            </div>

            {/* Timer Section */}
            <FuturisticCard title="Smart Study Timer" icon={Timer}>
              <div className="flex flex-col items-center py-4">
                <div className="text-5xl font-mono font-black text-slate-800 mb-6 tracking-tighter">
                  {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:
                  {(timeLeft % 60).toString().padStart(2, '0')}
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    className={`px-8 py-3 rounded-2xl font-bold transition-all ${isTimerRunning ? 'bg-slate-100 text-slate-600' : 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'}`}
                  >
                    {isTimerRunning ? 'Pause' : 'Start Focus'}
                  </button>
                  <button 
                    onClick={() => { setIsTimerRunning(false); setTimeLeft(25 * 60); }}
                    className="p-3 bg-slate-100 text-slate-500 rounded-2xl"
                  >
                    <Clock className="w-6 h-6" />
                  </button>
                </div>
                <div className="mt-6 flex gap-2">
                  {['Deep Study', 'Revision', 'Quick Practice'].map(mode => (
                    <button key={mode} className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-wider">
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </FuturisticCard>

            {/* Tasks Section */}
            <FuturisticCard title="Today's Tasks" icon={CheckCircle2}>
              <div className="space-y-3">
                {tasks.slice(0, 3).map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl group">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleTask(task)}>
                        {task.completed ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-slate-300" />}
                      </button>
                      <span className={`text-sm font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {task.title}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full uppercase">
                        {task.category}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {format(new Date(task.endDate), 'MMM d')}
                      </span>
                      {task.reminderTime && (
                        <span className="text-[9px] font-bold text-blue-500 flex items-center gap-1">
                          <Bell className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => setActiveTab('tasks')}
                  className="w-full py-3 text-sm font-bold text-blue-500 flex items-center justify-center gap-2 hover:bg-blue-50 rounded-2xl transition-colors"
                >
                  View All Tasks <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </FuturisticCard>

            {/* Analytics */}
            <div className="grid grid-cols-2 gap-4">
              <FuturisticCard title="App Usage" icon={Clock}>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-500">Instagram</span>
                    <span className="text-red-500">45m (Wasted)</span>
                  </div>
                  <ProgressBar progress={75} color="bg-red-400" />
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-500">Study Command</span>
                    <span className="text-green-500">2h (Productive)</span>
                  </div>
                  <ProgressBar progress={40} color="bg-green-400" />
                </div>
              </FuturisticCard>
              <FuturisticCard title="Upcoming" icon={BookOpen}>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-800">C Programming Mid-1</p>
                  <p className="text-[8px] text-slate-400 uppercase">In 3 Days</p>
                  <div className="h-1 w-full bg-blue-100 rounded-full mt-2" />
                </div>
              </FuturisticCard>
            </div>

            <FuturisticCard title="Time Utilization" icon={BarChart3}>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="study" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="target" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </FuturisticCard>
          </>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-slate-900">Task Manager</h1>
              <button 
                onClick={() => setIsTaskModalOpen(true)}
                className="bg-blue-500 text-white p-3 rounded-2xl shadow-lg shadow-blue-500/30"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {tasks.map(task => (
                <motion.div 
                  layout
                  key={task.id} 
                  className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <button onClick={() => toggleTask(task)}>
                      {task.completed ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6 text-slate-300" />}
                    </button>
                    <div>
                      <h3 className={`font-bold ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{task.category}</span>
                        <span className={`text-[10px] font-bold uppercase ${(profile?.customPriorities || DEFAULT_PRIORITIES).find(p => p.label === task.priority)?.color || 'text-blue-500'}`}>
                          {task.priority}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(task.startDate), 'MMM d')} - {format(new Date(task.endDate), 'MMM d, h:mm a')}
                        </span>
                        {task.reminderTime && (
                          <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            {format(new Date(task.reminderTime), 'h:mm a')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Task Creation Modal */}
        <AnimatePresence>
          {isTaskModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsTaskModalOpen(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
              >
                <h2 className="text-2xl font-black text-slate-900 mb-6">New Task</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Title</label>
                    <input 
                      type="text"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="Enter task title..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Category</label>
                      <select 
                        value={newTask.category}
                        onChange={(e) => setNewTask({ ...newTask, category: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {['Homework', 'Assignment', 'Study', 'Project', 'Revision'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Priority</label>
                      <select 
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {(profile?.customPriorities || DEFAULT_PRIORITIES).map(p => (
                          <option key={p.id} value={p.label}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Start Date & Time</label>
                      <input 
                        type="datetime-local"
                        value={newTask.startDate}
                        onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">End Date & Time</label>
                      <input 
                        type="datetime-local"
                        value={newTask.endDate}
                        onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block flex items-center gap-2">
                      <Bell className="w-3 h-3 text-blue-500" />
                      Reminder Alarm (Optional)
                    </label>
                    <input 
                      type="datetime-local"
                      value={newTask.reminderTime}
                      onChange={(e) => setNewTask({ ...newTask, reminderTime: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="flex gap-4 mt-8">
                    <button 
                      onClick={() => setIsTaskModalOpen(false)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={addTask}
                      className="flex-1 py-4 bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-colors"
                    >
                      Create Task
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {isConfirmModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-blue-100"
              >
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Complete Task?</h3>
                <p className="text-slate-500 text-center text-sm mb-8">
                  Are you sure you want to mark "<span className="font-semibold text-slate-700">{taskToComplete?.title}</span>" as completed?
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setIsConfirmModalOpen(false);
                      setTaskToComplete(null);
                    }}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmToggleTask}
                    className="flex-1 py-3 bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-colors"
                  >
                    Yes, Complete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {activeTab === 'ai' && (
          <div className="flex flex-col h-[calc(100vh-180px)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl">
                <Brain className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900">AI COMMAND</h1>
                <p className="text-xs text-blue-500 font-bold uppercase tracking-widest">JARVIS Protocol Active</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scrollbar-hide">
              {chatHistory.length === 0 && (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                    <MessageSquare className="w-8 h-8 text-blue-500" />
                  </div>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    Ask me about C Programming, Math, or any Diploma CSE subject. I'm here to help you excel.
                  </p>
                  
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Communication Trainer</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {["How to introduce myself?", "Confidence tips", "Interview prep"].map(q => (
                        <button 
                          key={q}
                          onClick={() => setChatInput(q)}
                          className="px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-100 transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Study Topics</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {["Explain Ohm's Law", "C Loops Example", "Study Tips"].map(q => (
                        <button 
                          key={q}
                          onClick={() => setChatInput(q)}
                          className="px-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:border-blue-200 transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-3xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-500 text-white rounded-tr-none' 
                      : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none shadow-sm'
                  }`}>
                    {msg.parts[0].text}
                  </div>
                </motion.div>
              ))}
              {isAiLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-100 p-4 rounded-3xl rounded-tl-none shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="relative">
              <input 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Type your command..."
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-6 pr-24 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <div className="absolute right-2 top-2 flex gap-1">
                <button className="p-2 text-slate-400 hover:text-blue-500 transition-colors">
                  <Mic className="w-5 h-5" />
                </button>
                <button 
                  onClick={sendChatMessage}
                  className="bg-blue-500 text-white p-2 rounded-xl shadow-lg shadow-blue-500/20"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'formulas' && (
          <div className="space-y-8 pb-12">
            <header className="space-y-1">
              <h1 className="text-2xl font-black text-slate-900">Formula Revision</h1>
              <p className="text-slate-500 text-sm">Quickly review key formulas for your CSE subjects.</p>
            </header>

            {formulaData.map((subjectData) => (
              <div key={subjectData.subject} className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 border-l-4 border-blue-500 pl-3">
                  {subjectData.subject}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subjectData.formulas.map((f, idx) => (
                    <FormulaCard 
                      key={idx}
                      name={f.name}
                      formula={f.formula}
                      description={f.description}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="flex flex-col items-center py-8">
              <div className="relative">
                <img 
                  src={profile?.photoURL || 'https://picsum.photos/seed/student/200/200'} 
                  className="w-32 h-32 rounded-3xl border-4 border-white shadow-2xl"
                  alt="Profile"
                />
                <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-2 rounded-xl shadow-lg">
                  <Trophy className="w-5 h-5" />
                </div>
              </div>
              <h1 className="mt-6 text-2xl font-black text-slate-900">{profile?.displayName}</h1>
              <p className="text-slate-500 font-medium">{profile?.email}</p>
            </div>

            <FuturisticCard title="Achievements" icon={Trophy}>
              <div className="grid grid-cols-3 gap-4">
                {profile?.badges.map(badge => (
                  <div key={badge} className="flex flex-col items-center text-center gap-2">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                      <Zap className="w-6 h-6 text-amber-500" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{badge}</span>
                  </div>
                ))}
              </div>
            </FuturisticCard>

            <FuturisticCard title="Custom Priority Levels" icon={ShieldCheck}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2">
                  {(profile?.customPriorities || DEFAULT_PRIORITIES).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${p.color.replace('text-', 'bg-')}`} />
                        <span className={`text-sm font-bold ${p.color}`}>{p.label}</span>
                      </div>
                      {profile?.customPriorities && (
                        <button 
                          onClick={() => deleteCustomPriority(p.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Add New Priority</p>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newPriority.label}
                      onChange={(e) => setNewPriority({ ...newPriority, label: e.target.value })}
                      placeholder="e.g. Critical"
                      className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <select 
                      value={newPriority.color}
                      onChange={(e) => setNewPriority({ ...newPriority, color: e.target.value })}
                      className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none"
                    >
                      {PRIORITY_COLORS.map(c => (
                        <option key={c.class} value={c.class}>{c.name}</option>
                      ))}
                    </select>
                    <button 
                      onClick={addCustomPriority}
                      className="bg-blue-500 text-white p-2 rounded-xl shadow-lg shadow-blue-500/20"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </FuturisticCard>

            <button 
              onClick={logout}
              className="w-full py-4 bg-red-50 text-red-500 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
            >
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>
        )}
      </main>

      {/* Background Quote */}
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-0 pointer-events-none opacity-20 select-none text-center max-w-2xl px-4">
        <p className="text-xl font-serif italic text-slate-900 mb-2">"{currentQuote}"</p>
      </div>

      {/* Voice Assistant UI */}
      <AnimatePresence>
        {isVoiceMode && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-xs"
          >
            <div className="bg-slate-900/90 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-4 shadow-2xl flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 w-full">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20" />
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center relative z-10">
                    <Mic className="w-5 h-5 text-white animate-pulse" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Voice Assistant Active</p>
                  <p className="text-white text-sm font-medium truncate">{voiceStatus || 'Listening for commands...'}</p>
                </div>
                <button 
                  onClick={toggleVoiceMode}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <MicOff className="w-5 h-5" />
                </button>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  animate={{ width: isListening ? '100%' : '0%' }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="h-full bg-blue-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Toggle Button */}
      <div className="fixed bottom-32 right-8 z-50">
        <button 
          onClick={toggleVoiceMode}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all ${isVoiceMode ? 'bg-red-500 text-white scale-110' : 'bg-blue-500 text-white hover:scale-110 active:scale-95'}`}
        >
          {isVoiceMode ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          {!isVoiceMode && (
            <div className="absolute -top-1 -right-1 bg-emerald-500 w-4 h-4 rounded-full border-2 border-slate-50 animate-pulse" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="fixed bottom-6 left-6 right-6 bg-slate-900/95 backdrop-blur-lg rounded-3xl p-2 flex items-center justify-between shadow-2xl z-50">
        {[
          { id: 'dashboard', icon: Layout, label: 'Home' },
          { id: 'tasks', icon: CheckCircle2, label: 'Tasks' },
          { id: 'formulas', icon: BookOpen, label: 'Formulas' },
          { id: 'ai', icon: Brain, label: 'AI' },
          { id: 'profile', icon: UserIcon, label: 'Me' }
        ].map(item => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all ${
              activeTab === item.id ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
