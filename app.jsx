import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, getDocs, addDoc, query, where 
} from 'firebase/firestore';

// Твой конфиг Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDbWUnP1jjdVGenDJq3MKL9767x5VyQqeA",
  authDomain: "fit-6b3a7.firebaseapp.com",
  projectId: "fit-6b3a7",
  storageBucket: "fit-6b3a7.firebasestorage.app",
  messagingSenderId: "193549143717",
  appId: "1:193549143717:web:84b37c62223b19fe8b074c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function WashFitApp() {
  const [user, setUser] = useState(null);
  const [washes, setWashes] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Хардкод моек для MVP (потом берется из Firestore)
  const astanaWashes = [
    { id: 1, name: "AquaClean Центр", address: "ул. Достык, 12", status: "🟢 Свободно" },
    { id: 2, name: "Wash&Go Левый Берег", address: "пр. Мангилик Ел, 45", status: "🔴 Очередь" },
    { id: 3, name: "Блеск-Авто", address: "пр. Туран, 37", status: "🟡 Средне" },
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    setWashes(astanaWashes);
    return () => unsubscribe();
  }, []);

  const handleAuth = async (isLogin) => {
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      alert("Ошибка авторизации: " + error.message);
    }
  };

  const bookWash = async (washId, washName) => {
    if (!user) return alert("Пожалуйста, авторизуйтесь для бронирования!");
    
    try {
      await addDoc(collection(db, "bookings"), {
        userId: user.uid,
        washId: washId,
        time: new Date(),
        status: "pending"
      });
      alert(`Успешно! Вы забронировали место на мойке: ${washName}`);
    } catch (e) {
      console.error("Ошибка при бронировании: ", e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {/* Навигация */}
      <nav className="flex justify-between items-center p-6 bg-black border-b border-gray-800">
        <h1 className="text-3xl font-black tracking-tighter uppercase text-blue-500">Wash<span className="text-white">Fit</span></h1>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user.email}</span>
            <button onClick={() => signOut(auth)} className="bg-red-600 px-4 py-2 rounded font-bold hover:bg-red-700 transition">Выйти</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input 
              type="text" placeholder="Email" className="p-2 rounded bg-gray-800 text-white border border-gray-700"
              onChange={(e) => setEmail(e.target.value)} 
            />
            <input 
              type="password" placeholder="Пароль" className="p-2 rounded bg-gray-800 text-white border border-gray-700"
              onChange={(e) => setPassword(e.target.value)} 
            />
            <button onClick={() => handleAuth(true)} className="bg-blue-600 px-4 py-2 rounded font-bold hover:bg-blue-700">Войти</button>
            <button onClick={() => handleAuth(false)} className="bg-gray-700 px-4 py-2 rounded font-bold hover:bg-gray-600">Рега</button>
          </div>
        )}
      </nav>

      <main className="max-w-6xl mx-auto p-6 space-y-12">
        
        {/* Тарифы */}
        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-700 pb-2">Выбери свой тариф</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { time: "1 Месяц", price: "15 000 ₸", desc: "Безлимитная экспресс-мойка" },
              { time: "6 Месяцев", price: "75 000 ₸", desc: "Экономия 15 000 ₸ + 1 химчистка" },
              { time: "1 Год", price: "130 000 ₸", desc: "VIP статус, приоритетная очередь" },
            ].map((tariff, idx) => (
              <div key={idx} className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover:border-blue-500 transition cursor-pointer">
                <h3 className="text-xl font-black uppercase">{tariff.time}</h3>
                <p className="text-3xl font-bold text-blue-500 my-4">{tariff.price}</p>
                <p className="text-gray-400 mb-6">{tariff.desc}</p>
                <button className="w-full bg-white text-black font-bold py-3 rounded hover:bg-gray-200">Купить</button>
              </div>
            ))}
          </div>
        </section>

        {/* Локации и Бронь */}
        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-700 pb-2">Доступные мойки в Астане</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {washes.map((wash) => (
              <div key={wash.id} className="flex justify-between items-center bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div>
                  <h3 className="text-xl font-bold">{wash.name}</h3>
                  <p className="text-gray-400">{wash.address}</p>
                  <p className="text-sm mt-2 font-mono">{wash.status}</p>
                </div>
                <button 
                  onClick={() => bookWash(wash.id, wash.name)}
                  className="bg-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/30"
                >
                  Забронировать
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Франшиза B2B */}
        <section className="bg-gradient-to-r from-blue-900 to-black p-10 rounded-2xl border border-blue-800 text-center">
          <h2 className="text-3xl font-black mb-4 uppercase">Открой мойку под нашим брендом</h2>
          <p className="text-gray-300 max-w-2xl mx-auto mb-8">
            Подключи свою автомойку к сети WashFit. Мы даем стабильный поток клиентов по подписке, CRM-систему для управления и маркетинговую поддержку.
          </p>
          <button className="bg-white text-black px-8 py-4 rounded-full font-black text-lg hover:scale-105 transition transform">
            Оставить заявку партнера
          </button>
        </section>

      </main>
    </div>
  );
}
