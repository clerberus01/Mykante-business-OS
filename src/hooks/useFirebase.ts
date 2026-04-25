import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, limit, where, getDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, reportFirestoreError } from '../lib/firebase';
import { Client, TimelineEvent, Project, Milestone, Task, ActivityLog, Proposal, Transaction } from '../types';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientsData);
      setLoading(false);
    }, (error) => {
      reportFirestoreError(error, 'list', 'clients');
      setClients([]);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const addClient = async (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const now = Date.now();
      const docRef = await addDoc(collection(db, 'clients'), {
        ...client,
        createdAt: now,
        updatedAt: now,
      });
      await updateDoc(docRef, { id: docRef.id });
    } catch (error) {
      handleFirestoreError(error, 'create', 'clients');
    }
  };

  const deleteClient = async (id: string) => {
    if (!confirm('Deseja realmente excluir este cliente?')) return;
    try {
      await deleteDoc(doc(db, 'clients', id));
    } catch (error) {
      handleFirestoreError(error, 'delete', 'clients');
    }
  };

  const updateClient = async (id: string, data: Partial<Client>) => {
    try {
      await updateDoc(doc(db, 'clients', id), {
        ...data,
        updatedAt: Date.now(),
      });
    } catch (error) {
      handleFirestoreError(error, 'update', 'clients');
    }
  };

  return { clients, loading, addClient, deleteClient, updateClient };
}

export function useEvents(clientId: string | null) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, `clients/${clientId}/events`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimelineEvent));
      setEvents(eventsData);
      setLoading(false);
    }, (error) => {
      reportFirestoreError(error, 'list', `clients/${clientId}/events`);
      setEvents([]);
      setLoading(false);
    });

    return unsubscribe;
  }, [clientId]);

  const addEvent = async (event: Omit<TimelineEvent, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!clientId) return;
    try {
      const docRef = await addDoc(collection(db, `clients/${clientId}/events`), {
        ...event,
        createdAt: Date.now(),
        createdBy: 'Clerberus', // Hardcoded for this OS
      });
      await updateDoc(docRef, { id: docRef.id });
    } catch (error) {
      handleFirestoreError(error, 'create', `clients/${clientId}/events`);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!clientId) return;
    try {
      await deleteDoc(doc(db, `clients/${clientId}/events`, eventId));
    } catch (error) {
      handleFirestoreError(error, 'delete', `clients/${clientId}/events`);
    }
  };

  return { events, loading, addEvent, deleteEvent };
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
      setLoading(false);
    }, (error) => {
      reportFirestoreError(error, 'list', 'projects');
      setProjects([]);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const addProject = async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'progress'>) => {
    try {
      const now = Date.now();
      const docRef = await addDoc(collection(db, 'projects'), {
        ...project,
        progress: 0,
        createdAt: now,
        updatedAt: now,
      });
      await updateDoc(docRef, { id: docRef.id });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, 'create', 'projects');
    }
  };

  const updateProject = async (id: string, data: Partial<Project>) => {
    try {
      await updateDoc(doc(db, 'projects', id), {
        ...data,
        updatedAt: Date.now(),
      });
    } catch (error) {
      handleFirestoreError(error, 'update', 'projects');
    }
  };

  return { projects, loading, addProject, updateProject };
}

export function useMilestones(projectId: string | null) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setMilestones([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, `projects/${projectId}/milestones`), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMilestones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Milestone)));
      setLoading(false);
    }, (error) => {
      reportFirestoreError(error, 'list', 'milestones');
      setMilestones([]);
      setLoading(false);
    });
    return unsubscribe;
  }, [projectId]);

  const addMilestone = async (milestone: Omit<Milestone, 'id' | 'createdAt'>) => {
    if (!projectId) return;
    try {
      const docRef = await addDoc(collection(db, `projects/${projectId}/milestones`), {
        ...milestone,
        createdAt: Date.now(),
      });
      await updateDoc(docRef, { id: docRef.id });
    } catch (error) {
      handleFirestoreError(error, 'create', 'milestones');
    }
  };

  const updateMilestone = async (id: string, data: Partial<Milestone>) => {
    if (!projectId) return;
    try {
      await updateDoc(doc(db, `projects/${projectId}/milestones`, id), data);
    } catch (error) {
      handleFirestoreError(error, 'update', 'milestones');
    }
  };

  return { milestones, loading, addMilestone, updateMilestone };
}

export function useTasks(projectId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, `projects/${projectId}/tasks`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
      setLoading(false);
    }, (error) => {
      reportFirestoreError(error, 'list', 'tasks');
      setTasks([]);
      setLoading(false);
    });
    return unsubscribe;
  }, [projectId]);

  const addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!projectId) return;
    try {
      const now = Date.now();
      const docRef = await addDoc(collection(db, `projects/${projectId}/tasks`), {
        ...task,
        createdAt: now,
        updatedAt: now,
      });
      await updateDoc(docRef, { id: docRef.id });
    } catch (error) {
      handleFirestoreError(error, 'create', 'tasks');
    }
  };

  const updateTask = async (id: string, data: Partial<Task>) => {
    if (!projectId) return;
    try {
      await updateDoc(doc(db, `projects/${projectId}/tasks`, id), {
        ...data,
        updatedAt: Date.now(),
      });
    } catch (error) {
      handleFirestoreError(error, 'update', 'tasks');
    }
  };

  return { tasks, loading, addTask, updateTask };
}

export function useProjectActivity(projectId: string | null) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, `projects/${projectId}/activity`), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
    });
    return unsubscribe;
  }, [projectId]);

  const addActivity = async (action: string, details: string, userName: string) => {
    if (!projectId) return;
    try {
      await addDoc(collection(db, `projects/${projectId}/activity`), {
        projectId,
        userId: 'system', 
        userName,
        action,
        details,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Log error", error);
    }
  };

  return { activities, addActivity };
}

export function useProposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProposals = useCallback(async () => {
    const q = query(collection(db, 'proposals'), orderBy('createdAt', 'desc'));
    setLoading(true);

    try {
      const snapshot = await getDocs(q);
      setProposals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Proposal)));
    } catch (error) {
      reportFirestoreError(error, 'list', 'proposals');
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  const addProposal = async (data: Omit<Proposal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    await addDoc(collection(db, 'proposals'), {
      ...data,
      createdAt: now,
      updatedAt: now
    });
    await loadProposals();
  };

  const updateProposal = async (id: string, data: Partial<Proposal>) => {
    const docRef = doc(db, 'proposals', id);
    const now = Date.now();
    
    // Check if status is transitioning to 'accepted'
    if (data.status === 'accepted') {
      const proposalDoc = await getDoc(docRef);
      const proposal = proposalDoc.data() as Proposal;
      
      // Prevent multiple transactions for the same proposal
      const existingTxQuery = query(
        collection(db, 'transactions'), 
        where('description', '==', `Proposta Aceita: ${proposal.title}`),
        where('clientId', '==', proposal.clientId)
      );
      const existingTx = await getDocs(existingTxQuery);
      
      if (existingTx.empty) {
        // Auto-generate transaction
        await addDoc(collection(db, 'transactions'), {
          type: 'income',
          amount: proposal.value,
          description: `Proposta Aceita: ${proposal.title}`,
          date: now,
          dueDate: now + (7 * 24 * 60 * 60 * 1000), // Default 7 days
          status: 'pending',
          category: 'Vendas',
          clientId: proposal.clientId,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    await updateDoc(docRef, {
      ...data,
      updatedAt: now
    });

    await loadProposals();
  };

  return { proposals, loading, addProposal, updateProposal };
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    setLoading(true);

    try {
      const snapshot = await getDocs(q);
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    } catch (error) {
      reportFirestoreError(error, 'list', 'transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const addTransaction = async (data: Omit<Transaction, 'id' | 'createdAt'>) => {
    try {
      const docRef = await addDoc(collection(db, 'transactions'), {
        ...data,
        createdAt: Date.now(),
      });
      await updateDoc(docRef, { id: docRef.id });
      await loadTransactions();
    } catch (error) {
      handleFirestoreError(error, 'create', 'transactions');
    }
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    try {
      await updateDoc(doc(db, 'transactions', id), data);
      await loadTransactions();
    } catch (error) {
      handleFirestoreError(error, 'update', 'transactions');
    }
  };

  return { transactions, loading, addTransaction, updateTransaction };
}
