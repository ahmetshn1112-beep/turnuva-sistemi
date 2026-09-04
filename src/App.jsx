import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Trophy, Calendar, Users, Settings, Play, CheckCircle2, ChevronRight, Award, Moon, Sun, Trash2, Download, Crown, Plus, Camera } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function App() {
  // LocalStorage'dan veri okuma fonksiyonu
  const loadState = (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  // State'leri LocalStorage'dan başlatıyoruz
  const [step, setStep] = useState(() => loadState('tourney_step', 0));
  const [config, setConfig] = useState(() => loadState('tourney_config', { tourneyName: 'Halı Saha Turnuvası', format: 'groups', groupCount: 2, teamsPerGroup: 4, teamsPerGroupToAdvance: 2 }));
  
  // AÇILIŞ (SPLASH SCREEN) STATE'İ - YENİ
  // Sadece turnuva kurulum aşamasındaysa (step === 0) açılış ekranını gösterir
  const [showSplash, setShowSplash] = useState(() => {
    const savedStep = loadState('tourney_step', 0);
    return savedStep === 0;
  });
  
  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, [showSplash]);
  const [teams, setTeams] = useState(() => loadState('tourney_teams', []));
  const [matches, setMatches] = useState(() => loadState('tourney_matches', []));
  const [isDarkMode, setIsDarkMode] = useState(() => loadState('tourney_darkmode', false));

  // Herhangi bir state değiştiğinde otomatik olarak LocalStorage'a kaydet
  useEffect(() => { localStorage.setItem('tourney_step', JSON.stringify(step)); }, [step]);
  useEffect(() => { localStorage.setItem('tourney_config', JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem('tourney_teams', JSON.stringify(teams)); }, [teams]);
  useEffect(() => { localStorage.setItem('tourney_matches', JSON.stringify(matches)); }, [matches]);
  
  // Gece modu değiştiğinde HTML etiketine 'dark' class'ını ekle/çıkar
  useEffect(() => { 
    localStorage.setItem('tourney_darkmode', JSON.stringify(isDarkMode)); 
    if(isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // ŞAMPİYON STATE'İ
  const [champion, setChampion] = useState(() => loadState('tourney_champion', null));
  useEffect(() => { localStorage.setItem('tourney_champion', JSON.stringify(champion)); }, [champion]);

  // YENİ AŞAMA 3: ZAMAN VE TARİH SİSTEMİ (Gerçek Zamanlı Geri Sayım ve Formatlayıcılar)
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    if (step !== 2) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  const formatTurkishDate = (dateStr) => {
    if (!dateStr) return "Tarih Belirlenmedi";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = d.toLocaleDateString('tr-TR', { day: '2-digit' });
      const month = d.toLocaleDateString('tr-TR', { month: 'long' });
      const year = d.getFullYear();
      const weekday = d.toLocaleDateString('tr-TR', { weekday: 'long' });
      return `${day} ${month} ${year} • ${weekday}`;
    } catch (e) {
      return dateStr;
    }
  };

  const getMatchDayLabel = (dateStr) => {
    if (!dateStr) return "";
    const matchDate = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (matchDate.toDateString() === today.toDateString()) return "BUGÜN";
    if (matchDate.toDateString() === tomorrow.toDateString()) return "YARIN";
    return "";
  };

  // YENİ EKLENEN: AKTİF SEKME STATELERİ
  const [activeGroupTab, setActiveGroupTab] = useState(0);
  const [activeWeekTab, setActiveWeekTab] = useState(1);
  const [isAddingMatch, setIsAddingMatch] = useState(false);
  const [newMatch, setNewMatch] = useState({ homeId: '', awayId: '' });
  
  // YENİ: MANUEL PLAY-OFF STATELERİ
  const [isAddingPlayoff, setIsAddingPlayoff] = useState(false);
  const [newPlayoff, setNewPlayoff] = useState({ round: 'Çeyrek Final', homeId: '', awayId: '' });

  // YENİ: KADRO VE OYUNCU STATELERİ
  const [players, setPlayers] = useState(() => loadState('tourney_players', []));
  useEffect(() => { localStorage.setItem('tourney_players', JSON.stringify(players)); }, [players]);
  const [selectedTeamForRoster, setSelectedTeamForRoster] = useState(null); // Hangi takımın kadrosu açık?
  const [newPlayer, setNewPlayer] = useState({ name: '', number: '' });

  const handleAddPlayer = () => {
    if (!newPlayer.name.trim()) return;
    const p = { id: `p-${Date.now()}`, teamId: selectedTeamForRoster.id, name: newPlayer.name, number: newPlayer.number, goals: 0 };
    setPlayers([...players, p]);
    setNewPlayer({ name: '', number: '' });
  };
  
  const handleDeletePlayer = (id) => {
    if (window.confirm("Bu oyuncuyu silmek istediğinize emin misiniz?")) {
      setPlayers(players.filter(p => p.id !== id));
    }
  };

  // YENİ: GENEL İSTATİSTİK (Gol, Sarı Kart, Kırmızı Kart) GÜNCELLEME FONKSİYONU
  const handleUpdateStat = (id, statType, delta) => {
    setPlayers(players.map(p => {
      if (p.id === id) {
        const newValue = Math.max(0, (p[statType] || 0) + delta);
        return { ...p, [statType]: newValue };
      }
      return p;
    }));
  };

  // GÖRSEL (PNG) DIŞA AKTAR REFERANSLARI
  const standingsExportRef = useRef(null);
  const fixtureExportRef = useRef(null);

  // PUAN DURUMUNU PNG OLARAK İNDİR (Mobilde Sıkışma/Kayma Önleyici Ayarlar Eklendi)
  const exportStandingsToPNG = async () => {
    if (!standingsExportRef.current) return;
    try {
      const el = standingsExportRef.current;
      // HTML2Canvas'in ekran genişliğini referans almasını engelliyoruz
      const originalStyle = el.style.cssText;
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.left = '0';
      el.style.zIndex = '-9999';
      el.style.opacity = '1';
      
      const canvas = await html2canvas(el, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: null,
        windowWidth: 1080 // Kritik Çözüm: Çözünürlüğü sabitle
      });
      
      el.style.cssText = originalStyle;
      
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `puan_durumu_grup_${String.fromCharCode(65 + activeGroupTab)}.png`;
      link.click();
    } catch (error) {
      console.error("Görsel oluşturulurken hata:", error);
    }
  };

  // FİKSTÜRÜ PNG OLARAK İNDİR (Mobilde Sıkışma/Kayma Önleyici Ayarlar Eklendi)
  const exportFixturesToPNG = async () => {
    if (!fixtureExportRef.current) return;
    try {
      const el = fixtureExportRef.current;
      const originalStyle = el.style.cssText;
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.left = '0';
      el.style.zIndex = '-9999';
      el.style.opacity = '1';
      
      const canvas = await html2canvas(el, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: null,
        windowWidth: 1080 // Kritik Çözüm: Çözünürlüğü sabitle
      });
      
      el.style.cssText = originalStyle;
      
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `hafta_${activeWeekTab}_fikstur.png`;
      link.click();
    } catch (error) {
      console.error("Görsel oluşturulurken hata:", error);
    }
  };

  // YENİ: ÖZEL PLAY-OFF EŞLEŞTİRME FONKSİYONU
  const handleGeneratePlayoffs = () => {
    const pMatches = matches.filter(m => m.groupId === 'playoff');
    
    if (pMatches.length === 0) {
      // 1. İLK ELEME TURU (Gruplardan Çıkanlar)
      const groupMatches = matches.filter(m => m.groupId !== 'playoff');
      if (groupMatches.some(m => !m.isPlayed)) {
        alert("Eleme turuna geçmek için gruptaki tüm maçların oynanması gerekir!");
        return;
      }

      let advanced = [];
      for (let g = 0; g < (config.format === 'league' ? 1 : config.groupCount); g++) {
        advanced.push(...standings[g].slice(0, config.teamsPerGroupToAdvance));
      }

      const newM = [];
      if (config.groupCount === 2 && config.teamsPerGroupToAdvance === 2) {
         // Çapraz Eşleşme (1A vs 2B , 1B vs 2A)
         newM.push({ id: `p-${Date.now()}-1`, groupId: 'playoff', round: 'Yarı Final', homeId: standings[0][0].id, awayId: standings[1][1].id, homeScore: '', awayScore: '', isPlayed: false, date: '', time: '' });
         newM.push({ id: `p-${Date.now()}-2`, groupId: 'playoff', round: 'Yarı Final', homeId: standings[1][0].id, awayId: standings[0][1].id, homeScore: '', awayScore: '', isPlayed: false, date: '', time: '' });
      } else {
         // Genel Eşleşme (Baştan ve Sondan)
         for (let i = 0; i < advanced.length / 2; i++) {
           newM.push({ id: `p-${Date.now()}-${i}`, groupId: 'playoff', round: 'Eleme Turu', homeId: advanced[i].id, awayId: advanced[advanced.length - 1 - i].id, homeScore: '', awayScore: '', isPlayed: false, date: '', time: '' });
         }
      }
      setMatches([...matches, ...newM]);
    } else {
      // 2. SONRAKİ TUR VEYA FİNAL
      const unplayed = pMatches.filter(m => !m.isPlayed);
      if (unplayed.length > 0) {
        alert('Sonraki tura geçmek için mevcut eleme maçlarının hepsine skor girmelisiniz!');
        return;
      }
      
      const lastRoundMatches = pMatches.filter(m => m.round === pMatches[pMatches.length - 1].round);
      const winners = lastRoundMatches.map(m => Number(m.homeScore) > Number(m.awayScore) ? teams.find(t=>t.id===m.homeId) : teams.find(t=>t.id===m.awayId));
      
      if (lastRoundMatches.some(m => Number(m.homeScore) === Number(m.awayScore))) {
        alert("Eleme maçları berabere bitemez! Lütfen penaltı/uzatma sonucuna göre skoru güncelleyin.");
        return;
      }

      if (winners.length === 1) {
        setChampion(winners[0]); // ŞAMPİYONU İLAN ET!
      } else {
        const newM = [];
        const nextRoundName = winners.length === 2 ? 'Final' : 'Sonraki Tur';
        for (let i = 0; i < winners.length; i += 2) {
           newM.push({ id: `p-${Date.now()}-${i}`, groupId: 'playoff', round: nextRoundName, homeId: winners[i].id, awayId: winners[i+1]?.id, homeScore: '', awayScore: '', isPlayed: false, date: '', time: '' });
        }
        setMatches([...matches, ...newM]);
      }
    }
  };

  // --- STEP 0: SETUP ---
  const handleConfigSubmit = (e) => {
    e.preventDefault();
    // Initialize teams array based on config
    const initialTeams = [];
    const groups = config.format === 'league' ? 1 : config.groupCount;
    
    for (let g = 0; g < groups; g++) {
      for (let t = 0; t < config.teamsPerGroup; t++) {
        initialTeams.push({
          id: `g${g}-t${t}`,
          groupId: g,
          name: '',
          color: '#3b82f6', // YENİ: Varsayılan olarak tatlı bir mavi renk atıyoruz
        });
      }
    }
    setTeams(initialTeams);
    setStep(1);
  };

  // --- YENİ EKLENEN SIFIRLAMA FONKSİYONU ---
  const handleReset = () => {
    if (window.confirm('Tüm turnuva verileri tamamen silinecek. Emin misiniz?')) {
      localStorage.clear();
      setStep(0);
      setConfig({ format: 'groups', groupCount: 2, teamsPerGroup: 4, teamsPerGroupToAdvance: 2 });
      setTeams([]);
      setMatches([]);
      setChampion(null);
    }
  };

  // --- STEP 1: TEAMS ---
  const handleTeamNameChange = (id, newName) => {
    setTeams(teams.map(t => t.id === id ? { ...t, name: newName } : t));
  };

  // Takım Silme Fonksiyonu
  const handleDeleteTeam = (id) => {
    setTeams(teams.filter(t => t.id !== id));
  };

  const generateFixtures = () => {
    if (teams.some(t => t.name.trim() === '')) {
      alert('Lütfen tüm takım isimlerini giriniz.');
      return;
    }

    const newMatches = [];
    const groups = config.format === 'league' ? 1 : config.groupCount;

    for (let g = 0; g < groups; g++) {
      let groupTeams = teams.filter(t => t.groupId === g);
      
      // Takım sayısı tek ise "BAY" diye sanal bir takım ekle
      if (groupTeams.length % 2 !== 0) {
        groupTeams.push({ id: `bay-team`, name: 'BAY', isBay: true });
      }

      const n = groupTeams.length;
      const rounds = n - 1; // Tek devrelik lig için hafta sayısı
      
      // Kullanıcı hafta girdiyse onu kullan, girmediyse çift devreli lig (rounds * 2) yap.
      const totalWeeks = config.totalWeeks || (rounds * 2);

      for (let week = 1; week <= totalWeeks; week++) {
        const roundZeroIndexed = (week - 1) % rounds;
        const isSecondHalf = Math.floor((week - 1) / rounds) % 2 === 1;

        for (let i = 0; i < n / 2; i++) {
          let home = groupTeams[i];
          let away = groupTeams[n - 1 - i];

          // Round-Robin takım döndürme mantığı
          if (roundZeroIndexed > 0) {
             if (i === 0) {
                home = groupTeams[0];
                away = groupTeams[(n - 1) - roundZeroIndexed];
             } else {
                let hIdx = (i - roundZeroIndexed);
                if (hIdx < 1) hIdx += (n - 1);
                let aIdx = (n - 1 - i - roundZeroIndexed);
                if (aIdx < 1) aIdx += (n - 1);
                
                home = groupTeams[hIdx];
                away = groupTeams[aIdx];
             }
          }

          // İkinci yarıda / rövanşlarda ev sahibi ve deplasman yer değiştirir
          if (isSecondHalf) {
            const temp = home;
            home = away;
            away = temp;
          }

          const isBayMatch = home.isBay || away.isBay;
          // Eğer bu maç bay maçıysa, gerçek takımı homeId'ye koyalım.
          const realTeam = home.isBay ? away : home;

          newMatches.push({
            id: `m-${g}-w${week}-${Date.now()}-${i}`,
            groupId: g,
            week: week, // Hangi haftanın maçı olduğu
            homeId: realTeam.id,
            awayId: isBayMatch ? 'BAY' : away.id,
            homeScore: '',
            awayScore: '',
            date: '',
            time: '',
            isPlayed: isBayMatch, // Bay maçları otomatik oynanmış (pas geçilmiş) sayılır
            isBay: isBayMatch
          });
        }
      }
    }
    setMatches(newMatches);
    setStep(2);
  };

  // --- YENİ: MAÇ SİLME VE MANUEL MAÇ EKLEME ---
  const handleDeleteMatch = (id) => {
    if (window.confirm("Bu maçı silmek istediğinize emin misiniz? Maç puan tablosundan düşülecektir.")) {
      setMatches(matches.filter(m => m.id !== id));
    }
  };

  const handleAddManualMatch = () => {
    if (!newMatch.homeId || !newMatch.awayId) {
      alert("Lütfen ev sahibi ve deplasman takımlarını seçin."); return;
    }
    if (newMatch.homeId === newMatch.awayId) {
      alert("Bir takım kendisiyle oynayamaz!"); return;
    }
    
    const isBayMatch = newMatch.awayId === 'BAY';
    const match = {
      id: `m-manual-${Date.now()}`,
      groupId: activeGroupTab,
      week: activeWeekTab,
      homeId: newMatch.homeId,
      awayId: newMatch.awayId,
      homeScore: '', awayScore: '', date: '', time: '',
      isPlayed: isBayMatch, isBay: isBayMatch
    };
    
    setMatches([...matches, match]);
    setIsAddingMatch(false);
    setNewMatch({ homeId: '', awayId: '' });
  };

  // YENİ: ÖZEL PLAY-OFF EŞLEŞTİRME FONKSİYONU
  const handleAddManualPlayoff = () => {
    if (!newPlayoff.homeId || !newPlayoff.awayId || !newPlayoff.round) {
      alert("Lütfen tur, ev sahibi ve deplasman takımlarını seçin."); return;
    }
    if (newPlayoff.homeId === newPlayoff.awayId) {
      alert("Bir takım kendisiyle eşleşemez!"); return;
    }

    const match = {
      id: `p-manual-${Date.now()}`,
      groupId: 'playoff',
      round: newPlayoff.round,
      homeId: newPlayoff.homeId,
      awayId: newPlayoff.awayId,
      homeScore: '', awayScore: '', date: '', time: '',
      isPlayed: false
    };

    setMatches([...matches, match]);
    setIsAddingPlayoff(false);
    setNewPlayoff({ round: 'Çeyrek Final', homeId: '', awayId: '' });
  };

  // --- STEP 2: DASHBOARD (SCORES & STANDINGS) ---
  const updateScore = (matchId, teamType, value) => {
    // Sadece 0 ile 99 arası sayılara izin ver
    if (value !== '') {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0 || num > 99) return;
    }
    const score = value === '' ? '' : parseInt(value, 10);

    setMatches(matches.map(m => {
      if (m.id === matchId) {
        const updatedMatch = { ...m, [teamType]: score };
        // İki skor da girildiyse maçı tamamlanmış say (Sonradan değiştirilirse puan durumu otomatik güncellenir)
        if (updatedMatch.homeScore !== '' && updatedMatch.awayScore !== '') {
          updatedMatch.isPlayed = true;
        } else {
          updatedMatch.isPlayed = false;
        }
        return updatedMatch;
      }
      return m;
    }));
  };

  // Yeni Fonksiyon: Maçın tarih veya saatini güncelleme
  const updateMatchDateTime = (matchId, field, value) => {
    setMatches(matches.map(m => m.id === matchId ? { ...m, [field]: value } : m));
  };

  // Calculate Standings dynamically (İkili Averaj ve Form Eklendi)
  const standings = useMemo(() => {
    const stats = {};
    
    // 1. İstatistikleri Sıfırla (Form array eklendi)
    teams.forEach(t => {
      stats[t.id] = { ...t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [] };
    });

    // Maçları haftaya göre sıralayarak işleyelim ki form durumu kronolojik olsun
    const chronologicalMatches = [...matches].sort((a, b) => a.week - b.week);

    // 2. Oynanmış Maçları İşle
    chronologicalMatches.filter(m => m.isPlayed).forEach(m => {
      // Playoff ve BAY maçlarını puan durumuna dahil etme
      if (m.groupId === 'playoff' || m.isBay) return; 

      const home = stats[m.homeId];
      const away = stats[m.awayId];
      if(!home || !away) return; // Güvenlik kontrolü

      const hScore = Number(m.homeScore);
      const aScore = Number(m.awayScore);

      home.played += 1; away.played += 1;
      home.gf += hScore; home.ga += aScore;
      away.gf += aScore; away.ga += hScore;
      
      if (hScore > aScore) {
        home.won += 1; away.lost += 1; home.points += 3;
        home.form.push('G'); away.form.push('M');
      } else if (hScore < aScore) {
        away.won += 1; home.lost += 1; away.points += 3;
        away.form.push('G'); home.form.push('M');
      } else {
        home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1;
        home.form.push('B'); away.form.push('B');
      }
    });

    // 3. Genel Averajı Hesapla ve Formu Son 5 Maç ile Sınırla
    Object.values(stats).forEach(team => { 
      team.gd = team.gf - team.ga; 
      team.form = team.form.slice(-5); // Sadece son 5 maç
    });

    const groups = config.format === 'league' ? 1 : config.groupCount;
    const groupedStandings = [];

    // 4. Sıralama Kuralları (FIFA Standartları)
    for (let g = 0; g < groups; g++) {
      const groupTeams = Object.values(stats).filter(t => t.groupId === g);
      
      groupTeams.sort((a, b) => {
        // Kural 1: Puan
        if (b.points !== a.points) return b.points - a.points;
        
        // Kural 2: İkili Averaj (Puanlar eşitse kendi aralarındaki maça bak)
        const h2hMatch = matches.find(m => m.isPlayed && m.groupId === g && 
          ((m.homeId === a.id && m.awayId === b.id) || (m.homeId === b.id && m.awayId === a.id)));
          
        if (h2hMatch) {
          let aH2hPoints = 0, bH2hPoints = 0;
          if (h2hMatch.homeId === a.id) {
            if (h2hMatch.homeScore > h2hMatch.awayScore) aH2hPoints = 3;
            else if (h2hMatch.homeScore < h2hMatch.awayScore) bH2hPoints = 3;
          } else {
            if (h2hMatch.awayScore > h2hMatch.homeScore) aH2hPoints = 3;
            else if (h2hMatch.awayScore < h2hMatch.homeScore) bH2hPoints = 3;
          }
          if (bH2hPoints !== aH2hPoints) return bH2hPoints - aH2hPoints;
        }

        // Kural 3: Genel Averaj
        if (b.gd !== a.gd) return b.gd - a.gd;
        
        // Kural 4: Atılan Gol
        return b.gf - a.gf;
      });
      groupedStandings.push(groupTeams);
    }

    return groupedStandings;
  }, [teams, matches, config]);


  // --- RENDERERS ---
  const renderSetup = () => (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 transition-colors">
      <div className="flex items-center justify-center mb-6 text-green-600">
        <Settings className="w-12 h-12" />
      </div>
      <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-6">Turnuva Ayarları</h2>
      <form onSubmit={handleConfigSubmit} className="space-y-6">
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Turnuva Adı</label>
          <input 
            type="text" 
            required
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none dark:bg-gray-700 dark:text-white transition-colors font-bold"
            value={config.tourneyName || ''} 
            onChange={e => setConfig({ ...config, tourneyName: e.target.value })}
            placeholder="Örn: Duruca Derneği 2. Turnuva"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Turnuva Formatı</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setConfig({ ...config, format: 'league', groupCount: 1 })}
              className={`p-3 border rounded-lg flex flex-col items-center justify-center transition-colors ${config.format === 'league' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            >
              <Trophy className="w-6 h-6 mb-2" />
              <span className="font-medium">Tek Lig</span>
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, format: 'groups' })}
              className={`p-3 border rounded-lg flex flex-col items-center justify-center transition-colors ${config.format === 'groups' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            >
              <Users className="w-6 h-6 mb-2" />
              <span className="font-medium">Gruplu Turnuva</span>
            </button>
          </div>
        </div>

        {config.format === 'groups' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grup Sayısı</label>
            <input 
              type="number" min="2" max="16" 
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none dark:bg-gray-700 dark:text-white transition-colors"
              value={config.groupCount === '' ? '' : config.groupCount} 
              onChange={e => setConfig({ ...config, groupCount: e.target.value === '' ? '' : parseInt(e.target.value) })}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {config.format === 'league' ? 'Takım Sayısı' : 'Grup Başı Takım'}
            </label>
            <input 
              type="number" min="3" max="20" 
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none dark:bg-gray-700 dark:text-white transition-colors"
              value={config.teamsPerGroup === '' ? '' : config.teamsPerGroup} 
              onChange={e => setConfig({ ...config, teamsPerGroup: e.target.value === '' ? '' : parseInt(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" title="Gruptan çıkıp Play-off'a kalacak takım sayısı">
              Gruptan Çıkan
            </label>
            <input 
              type="number" min="1" max="10" 
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none dark:bg-gray-700 dark:text-white transition-colors"
              value={config.teamsPerGroupToAdvance === '' ? '' : config.teamsPerGroupToAdvance} 
              onChange={e => setConfig({ ...config, teamsPerGroupToAdvance: e.target.value === '' ? '' : parseInt(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" title="Boş bırakılırsa otomatik hesaplanır">
              Toplam Hafta Sayısı
            </label>
            <input 
              type="number" min="1" max="30" placeholder="Oto"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none dark:bg-gray-700 dark:text-white transition-colors"
              value={config.totalWeeks || ''} 
              onChange={e => setConfig({ ...config, totalWeeks: e.target.value === '' ? '' : parseInt(e.target.value) })}
            />
          </div>
        </div>

        <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors">
          Takımları Gir <ChevronRight className="ml-2 w-5 h-5" />
        </button>
      </form>
    </div>
  );

  const renderTeamsSetup = () => {
    const groups = config.format === 'league' ? 1 : config.groupCount;
    const isReadyToGenerate = teams.length > 0 && teams.every(t => t.name.trim() !== '');

    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        
        {/* Üst Başlık Alanı */}
        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-t-3xl shadow-sm border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white flex items-center tracking-tight">
              <Users className="w-7 h-7 mr-3 text-blue-600 dark:text-blue-500" />
              Takım Kayıtları
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">Turnuvada mücadele edecek takımları ve renklerini belirleyin.</p>
          </div>
          <button onClick={() => setStep(0)} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors shrink-0">
            ← Ayarlara Dön
          </button>
        </div>

        {/* Gruplar Alanı */}
        <div className="bg-gray-50 dark:bg-gray-900/50 p-6 md:p-8 rounded-b-3xl shadow-xl border border-t-0 border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {Array.from({ length: groups }).map((_, gIndex) => (
              <div key={gIndex} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                <div className="bg-gray-100 dark:bg-gray-700/50 px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest text-sm">
                    {config.format === 'league' ? 'Lig Takımları' : `${String.fromCharCode(65 + gIndex)} GRUBU`}
                  </h3>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2.5 py-1 rounded-md">
                    {teams.filter(t => t.groupId === gIndex).length} Takım
                  </span>
                </div>
                
                <div className="p-3 space-y-2">
                  {teams.filter(t => t.groupId === gIndex).map((team, idx) => (
                    <div key={team.id} className="group flex items-center gap-3 bg-white hover:bg-blue-50/50 dark:bg-gray-800 dark:hover:bg-blue-900/20 p-2 pr-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all">
                      
                      {/* Sıra Numarası */}
                      <span className="w-7 h-7 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-bold flex items-center justify-center text-xs shrink-0 border border-gray-100 dark:border-gray-700">
                        {idx + 1}
                      </span>
                      
                      {/* ÇİFT RENK SEÇİCİ (MANUEL COLOR PICKER) */}
                      <div className="flex items-center -space-x-1.5 shrink-0 hover:space-x-0.5 transition-all cursor-pointer">
                        {/* 1. Renk */}
                        <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm relative z-10" title="1. Forma Rengi">
                          <input
                            type="color"
                            value={team.color1 || team.color || '#ffffff'}
                            onChange={(e) => setTeams(teams.map(t => t.id === team.id ? { ...t, color1: e.target.value } : t))}
                            className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer"
                          />
                        </div>
                        {/* 2. Renk */}
                        <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm relative z-0" title="2. Forma Rengi">
                          <input
                            type="color"
                            value={team.color2 || '#000000'}
                            onChange={(e) => setTeams(teams.map(t => t.id === team.id ? { ...t, color2: e.target.value } : t))}
                            className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Takım Adı Input */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          placeholder="Takım Adı Girin..."
                          className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white font-bold text-sm md:text-base focus:ring-0 p-0 placeholder-gray-400 dark:placeholder-gray-500 truncate"
                          value={team.name}
                          onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                        />
                      </div>

                      {/* Sil Butonu (Taşma Sorunu Çözüldü) */}
                      <button 
                        onClick={() => handleDeleteTeam(team.id)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shrink-0 opacity-50 group-hover:opacity-100"
                        title="Takımı Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {teams.filter(t => t.groupId === gIndex).length === 0 && (
                    <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm font-medium border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl mx-2 my-2">
                      Bu grupta takım bulunmuyor.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Fikstür Oluştur Butonu */}
          <button 
            onClick={generateFixtures} 
            disabled={!isReadyToGenerate}
            className={`w-full font-black py-4 px-6 rounded-2xl flex items-center justify-center text-lg md:text-xl shadow-xl transition-all active:scale-95
              ${isReadyToGenerate 
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white cursor-pointer transform hover:-translate-y-1' 
                : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border border-gray-300 dark:border-gray-700 cursor-not-allowed'}`}
          >
            {isReadyToGenerate ? <Play className="mr-3 w-6 h-6 fill-current" /> : <Users className="mr-3 w-6 h-6" />}
            {isReadyToGenerate ? 'Fikstürü Oluştur ve Turnuvayı Başlat' : 'Lütfen Tüm Takım İsimlerini Girin'}
          </button>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const groups = config.format === 'league' ? 1 : config.groupCount;
    
    // YENİ: TURNUVA DURUMU VE İSTATİSTİKLERİ HESAPLAMA
    const totalTeams = teams.length;
    const validMatches = matches.filter(m => !m.isBay);
    const totalMatches = validMatches.length;
    const playedMatches = validMatches.filter(m => m.isPlayed).length;
    const remainingMatches = totalMatches - playedMatches;
    const totalGoals = validMatches.filter(m => m.isPlayed).reduce((sum, m) => sum + Number(m.homeScore) + Number(m.awayScore), 0);
    const liveMatches = validMatches.filter(m => !m.isPlayed && (m.homeScore !== '' || m.awayScore !== '')).length;
    const hasPlayoffs = matches.some(m => m.groupId === 'playoff');
    
    let tourneyStatus = "🟢 DEVAM EDİYOR";
    let statusColor = "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
    
    if (champion) {
      tourneyStatus = "🏆 TAMAMLANDI";
      statusColor = "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
    } else if (hasPlayoffs) {
      const finalMatch = matches.find(m => m.groupId === 'playoff' && m.round === 'Final');
      if (finalMatch && finalMatch.isPlayed) {
         tourneyStatus = "🔴 FİNAL";
         statusColor = "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
      } else {
         tourneyStatus = "🟡 ELEME AŞAMASI";
         statusColor = "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800";
      }
    }

    // AŞAMA 3: SIRADAKİ MAÇ HESAPLAMA MANTIĞI
    const upcomingMatches = matches
      .filter(m => !m.isPlayed && !m.isBay && m.date)
      .map(m => {
        const dt = new Date(`${m.date}T${m.time || '00:00:00'}`);
        return { ...m, datetime: dt };
      })
      .filter(m => !isNaN(m.datetime.getTime()))
      .sort((a, b) => a.datetime - b.datetime);
      
    const nextMatch = upcomingMatches.length > 0 ? upcomingMatches[0] : null;
    let countdownStr = null;
    
    if (nextMatch) {
      const diff = nextMatch.datetime - currentTime;
      if (diff > 0 && diff <= 86400000 * 7) { // Sadece 7 günden yakınsa geri sayım göster (görüntü kirliliği olmasın)
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        countdownStr = d > 0 ? `${d} GÜN ${h} SAAT` : `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
      } else if (diff <= 0 && nextMatch.homeScore === '' && nextMatch.awayScore === '') {
        countdownStr = "MAÇ ZAMANI!";
      }
    }

    return (
      <div className="max-w-7xl mx-auto">
        
        {/* Kalıcı Şampiyonluk Afişi */}
        {champion && (
          <div className="mb-8 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 rounded-2xl p-6 shadow-2xl flex items-center justify-between border-4 border-yellow-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="flex items-center relative z-10">
              <Trophy className="w-16 h-16 mr-6 text-white drop-shadow-md" />
              <div>
                <p className="text-yellow-100 font-bold text-sm uppercase tracking-widest drop-shadow">Turnuva Şampiyonu</p>
                <h2 className="text-4xl font-black text-white drop-shadow-lg">{champion.name}</h2>
              </div>
            </div>
            <Crown className="w-24 h-24 text-yellow-300 opacity-50 absolute right-10 z-0" />
          </div>
        )}

        {/* PROFESYONEL TURNUVA BAŞLIĞI VE ÖZET ALANI */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8 transition-colors animate-fade-in">
          {/* Üst Kısım: Başlık ve Durum */}
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-700">
            <div>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest border mb-4 ${statusColor}`}>
                {tourneyStatus}
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight">
                {config.tourneyName || 'Turnuva Merkezi'}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 font-bold tracking-widest uppercase text-sm mt-1">
                FUTBOL TURNUVASI YÖNETİM MERKEZİ
              </p>
            </div>
            
            {/* Butonlar */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <button onClick={exportStandingsToPNG} className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold transition-colors flex items-center shadow-sm">
                <Camera className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" /> Puan Tablosu
              </button>
              <button onClick={exportFixturesToPNG} className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold transition-colors flex items-center shadow-sm">
                <Camera className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" /> Fikstür
              </button>
              <button onClick={handleReset} className="px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/50 rounded-xl text-sm font-bold transition-colors shadow-sm">
                Sıfırla
              </button>
            </div>
          </div>
          
          {/* Alt Kısım: Dinamik İstatistikler */}
          <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-y md:divide-y-0 divide-gray-100 dark:divide-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Takımlar</span>
              <span className="text-2xl font-black text-gray-800 dark:text-white">{totalTeams}</span>
            </div>
            <div className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Toplam Maç</span>
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{totalMatches}</span>
            </div>
            <div className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Oynanan</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{playedMatches}</span>
            </div>
            <div className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Kalan</span>
              <span className="text-2xl font-black text-gray-800 dark:text-white">{remainingMatches}</span>
            </div>
            <div className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Toplam Gol</span>
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{totalGoals}</span>
            </div>
            <div className="p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
              {liveMatches > 0 && <div className="absolute top-0 right-0 w-8 h-8 bg-red-500 rounded-bl-full animate-pulse blur-md opacity-30"></div>}
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Devam Eden</span>
              <span className={`text-2xl font-black ${liveMatches > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white'}`}>{liveMatches}</span>
            </div>
          </div>
        </div>

        {/* YENİ AŞAMA 3: SIRADAKİ MAÇ (NEXT MATCH) BİLEŞENİ */}
        {nextMatch && !champion && (
          <div className="mb-8 bg-gradient-to-r from-gray-900 to-gray-800 dark:from-black dark:to-gray-900 rounded-2xl shadow-xl border border-gray-700 overflow-hidden relative animate-fade-in">
            {/* Arkaplan Deseni */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 md:p-8 gap-6">
              
              {/* Sol: Etiket ve Tarih */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full shadow-sm">
                    Sıradaki Maç
                  </span>
                  {getMatchDayLabel(nextMatch.date) && (
                    <span className="bg-red-500 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full shadow-sm animate-pulse">
                      {getMatchDayLabel(nextMatch.date)}
                    </span>
                  )}
                </div>
                <div className="text-gray-300 font-bold text-sm uppercase tracking-wider flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  {formatTurkishDate(nextMatch.date)}
                </div>
                {nextMatch.time && (
                  <div className="text-gray-400 font-bold text-sm mt-1">
                    Saat: <span className="text-white text-base">{nextMatch.time}</span>
                  </div>
                )}
              </div>

              {/* Orta: Takımlar ve VS */}
              <div className="flex-1 flex items-center justify-center gap-4 w-full md:w-auto">
                <div className="flex-1 text-right font-black text-2xl md:text-3xl text-white truncate drop-shadow-md">
                  {teams.find(t => t.id === nextMatch.homeId)?.name || '???'}
                </div>
                <div className="shrink-0 bg-gray-800/80 border border-gray-600 rounded-xl px-4 py-2 flex flex-col items-center justify-center">
                  <span className="text-yellow-500 font-black text-sm tracking-widest">VS</span>
                </div>
                <div className="flex-1 text-left font-black text-2xl md:text-3xl text-white truncate drop-shadow-md">
                  {teams.find(t => t.id === nextMatch.awayId)?.name || '???'}
                </div>
              </div>

              {/* Sağ: Geri Sayım */}
              {countdownStr && (
                <div className="shrink-0 bg-black/40 border border-gray-600 rounded-xl p-4 flex flex-col items-center justify-center min-w-[140px] shadow-inner">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    {countdownStr === "MAÇ ZAMANI!" ? "DURUM" : "MAÇA KALAN"}
                  </span>
                  <span className={`text-2xl font-black tracking-wider font-mono ${countdownStr === "MAÇ ZAMANI!" ? "text-red-500 animate-pulse" : "text-yellow-400"}`}>
                    {countdownStr}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GRUP SEKMELERİ (Sadece Gruplu Turnuvada Görünür) */}
        {config.format === 'groups' && (
          <div className="flex space-x-3 mb-6 overflow-x-auto pb-2">
            {Array.from({ length: config.groupCount }).map((_, gIndex) => (
              <button
                key={gIndex}
                onClick={() => { setActiveGroupTab(gIndex); setActiveWeekTab(1); }}
                className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap shadow-sm ${activeGroupTab === gIndex ? 'bg-green-600 text-white transform scale-105' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'}`}
              >
                {String.fromCharCode(65 + gIndex)} Grubu
              </button>
            ))}
          </div>
        )}

        {/* İKİ SÜTUNLU DÜZEN (Sol: Puan Durumu, Sağ: Fikstür) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-12">
          
          {/* Puan Durumu Tablosu ve İstatistikler */}
          <div className="xl:col-span-7 flex flex-col gap-5">
            
            {/* Özet İstatistik Kartları */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center transition-colors">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-0.5 text-center">Oynanan Maç</span>
                <span className="text-xl font-black text-gray-800 dark:text-white">
                  {matches.filter(m => m.groupId === activeGroupTab && m.isPlayed && !m.isBay).length}
                </span>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center transition-colors">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-0.5 text-center">Toplam Gol</span>
                <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                  {matches.filter(m => m.groupId === activeGroupTab && m.isPlayed && !m.isBay).reduce((sum, m) => sum + Number(m.homeScore) + Number(m.awayScore), 0)}
                </span>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center transition-colors">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-0.5 text-center">Maç Başı Gol</span>
                <span className="text-xl font-black text-green-600 dark:text-green-400">
                  {(() => {
                    const played = matches.filter(m => m.groupId === activeGroupTab && m.isPlayed && !m.isBay);
                    const goals = played.reduce((sum, m) => sum + Number(m.homeScore) + Number(m.awayScore), 0);
                    return played.length > 0 ? (goals / played.length).toFixed(1) : '0.0';
                  })()}
                </span>
              </div>
            </div>

            {/* Tablo - Geçiş Animasyonlu */}
            <div key={`standings-group-${activeGroupTab}`} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-600 overflow-hidden transition-colors animate-fade-in">
              <div className="bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600 p-3">
                <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center tracking-wide">
                  <Trophy className="w-4 h-4 mr-2 text-yellow-600 dark:text-yellow-500" /> 
                  {config.format === 'league' ? 'LİG PUAN DURUMU' : `${String.fromCharCode(65 + activeGroupTab)} GRUBU PUAN DURUMU`}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] text-left text-gray-800 dark:text-gray-200 border-collapse">
                  <thead className="text-[11px] text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/80 uppercase font-black border-b-2 border-gray-300 dark:border-gray-600">
                    <tr>
                      <th className="px-2 py-2.5 text-center border-r border-gray-300 dark:border-gray-600 w-10">Sıra</th>
                      <th className="px-3 py-2.5 border-r border-gray-300 dark:border-gray-600">Takım</th>
                      <th className="px-2 py-2.5 text-center border-r border-gray-300 dark:border-gray-600" title="Oynanan">O</th>
                      <th className="px-2 py-2.5 text-center border-r border-gray-300 dark:border-gray-600 text-green-700 dark:text-green-400" title="Galibiyet">G</th>
                      <th className="px-2 py-2.5 text-center border-r border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400" title="Beraberlik">B</th>
                      <th className="px-2 py-2.5 text-center border-r border-gray-300 dark:border-gray-600 text-red-600 dark:text-red-400" title="Mağlubiyet">M</th>
                      <th className="px-2 py-2.5 text-center border-r border-gray-300 dark:border-gray-600" title="Atılan Gol">AG</th>
                      <th className="px-2 py-2.5 text-center border-r border-gray-300 dark:border-gray-600" title="Yenilen Gol">YG</th>
                      <th className="px-2 py-2.5 text-center border-r border-gray-300 dark:border-gray-600 font-bold" title="Averaj">AV</th>
                      <th className="px-2 py-2.5 text-center border-r border-gray-300 dark:border-gray-600 w-[90px]" title="Son 5 Maç">FORM</th>
                      <th className="px-2 py-2.5 text-center font-black text-green-800 dark:text-green-400 text-sm" title="Puan">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings[activeGroupTab]?.map((team, idx) => {
                      // Top 3 Madalya Mantığı
                      let rankStyle = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"; // Standart
                      if (idx === 0) rankStyle = "bg-yellow-400 text-yellow-900 shadow-md ring-2 ring-yellow-200"; // Altın
                      else if (idx === 1) rankStyle = "bg-gray-300 text-gray-800 shadow-sm ring-2 ring-gray-100"; // Gümüş
                      else if (idx === 2) rankStyle = "bg-amber-600 text-white shadow-sm ring-2 ring-amber-300"; // Bronz
                      else if (idx < config.teamsPerGroupToAdvance && config.format === 'groups') rankStyle = "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"; // Play-off bölgesi
                      
                      return (
                      <tr key={team.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-yellow-50 dark:hover:bg-gray-700/70 transition-colors even:bg-gray-50 dark:even:bg-gray-800/50">
                        <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700 font-medium">
                          <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-black ${rankStyle}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td 
                          className="px-3 py-2 font-bold flex items-center cursor-pointer hover:text-green-600 dark:hover:text-green-400 transition-colors group"
                          onClick={() => setSelectedTeamForRoster(team)}
                          title="Kadroyu Görmek/Düzenlemek için Tıkla"
                        >
                          <span 
                            className="w-3 h-3 rounded-full mr-2 shadow-sm border border-gray-300 dark:border-gray-500 group-hover:scale-125 transition-transform shrink-0" 
                            style={{ background: `linear-gradient(135deg, ${team.color1 || team.color || '#ffffff'} 50%, ${team.color2 || '#000000'} 50%)` }}
                          ></span>
                          <span className="truncate max-w-[140px]">{team.name}</span>
                        </td>
                        <td className="px-2 py-2 text-center border-l border-r border-gray-200 dark:border-gray-700">{team.played}</td>
                        <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700">{team.won}</td>
                        <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700">{team.drawn}</td>
                        <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700">{team.lost}</td>
                        <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700">{team.gf}</td>
                        <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700">{team.ga}</td>
                        <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-400">{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                        <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                          {/* YENİ: Takım Form Durumu (Son 5 Maç) */}
                          <div className="flex items-center justify-center gap-0.5">
                            {team.form && team.form.length > 0 ? team.form.map((f, i) => (
                              <span key={i} className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] font-black text-white shadow-sm ${f === 'G' ? 'bg-emerald-500' : f === 'M' ? 'bg-red-500' : 'bg-gray-400'}`}>
                                {f}
                              </span>
                            )) : (
                              <span className="text-[10px] text-gray-400 font-medium">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center font-black text-green-700 dark:text-green-400 text-sm bg-green-50/50 dark:bg-green-900/20">{team.points}</td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>

            {/* YENİ: GOL KRALLIĞI (TOP SCORERS) TABLOSU */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors animate-fade-in mt-2">
              <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600 p-4">
                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-purple-500" /> 
                  Gol Krallığı (İlk 5)
                </h3>
              </div>
              <div className="p-4">
                {(() => {
                  // Sadece aktif gruptaki takımların gol atan oyuncularını bul ve sırala
                  const groupTopScorers = players
                    .filter(p => {
                      const t = teams.find(team => team.id === p.teamId);
                      return t && t.groupId === activeGroupTab && p.goals > 0;
                    })
                    .sort((a, b) => b.goals - a.goals)
                    .slice(0, 5); 

                  if (groupTopScorers.length === 0) {
                    return <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4 font-medium">Henüz gol atan oyuncu bulunmuyor.</p>;
                  }

                  return (
                    <div className="space-y-3">
                      {groupTopScorers.map((player, idx) => {
                        const t = teams.find(team => team.id === player.teamId);
                        return (
                          <div key={`ts-${player.id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-4">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-sm ${idx === 0 ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-200' : idx === 1 ? 'bg-gray-300 text-gray-800' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
                                {idx + 1}
                              </span>
                              <div>
                                <p className="font-bold text-gray-800 dark:text-white leading-tight">{player.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1 font-medium">
                                  <span className="w-2.5 h-2.5 rounded-full shadow-sm border border-gray-300 dark:border-gray-600" style={{ background: `linear-gradient(135deg, ${t?.color1 || t?.color || '#ffffff'} 50%, ${t?.color2 || '#000000'} 50%)` }}></span>
                                  {t?.name}
                                </p>
                              </div>
                            </div>
                            <div className="text-right bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                              <span className="text-2xl font-black text-green-600 dark:text-green-400">{player.goals}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 font-bold">GOL</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
            
          </div>

          {/* Fikstür ve Hafta Sekmeleri */}
          <div className="xl:col-span-5 flex flex-col gap-4">
            
            {/* YENİ AŞAMA 5: PROFESYONEL HAFTA NAVİGASYONU VE İLERLEME ÇUBUĞU */}
            {(() => {
              const groupMatches = matches.filter(m => m.groupId === activeGroupTab && m.week);
              const maxWeek = groupMatches.length > 0 ? Math.max(...groupMatches.map(m => m.week)) : 1;
              const currentWeekMatches = groupMatches.filter(m => m.week === activeWeekTab);
              const playedThisWeek = currentWeekMatches.filter(m => m.isPlayed || m.isBay).length;
              const totalThisWeek = currentWeekMatches.length;
              const progressPercent = totalThisWeek > 0 ? Math.round((playedThisWeek / totalThisWeek) * 100) : 0;

              return (
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col gap-5 shadow-sm animate-fade-in mb-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setActiveWeekTab(Math.max(1, activeWeekTab - 1))}
                      disabled={activeWeekTab === 1}
                      className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-black text-sm rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      ← Önceki
                    </button>
                    
                    <div className="text-center flex flex-col items-center">
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-widest uppercase mb-0.5">
                        Fikstür
                      </span>
                      <h3 className="text-xl md:text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">
                        {activeWeekTab}. HAFTA
                      </h3>
                    </div>

                    <button
                      onClick={() => setActiveWeekTab(Math.min(maxWeek, activeWeekTab + 1))}
                      disabled={activeWeekTab === maxWeek}
                      className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-black text-sm rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Sonraki →
                    </button>
                  </div>

                  {/* İlerleme Çubuğu (Progress Bar) */}
                  {totalThisWeek > 0 && (
                    <div className="flex flex-col gap-2 px-1">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                        <span>Hafta İlerlemesi</span>
                        <span className={playedThisWeek === totalThisWeek ? "text-emerald-500" : ""}>{progressPercent}% • {playedThisWeek} / {totalThisWeek} Maç</span>
                      </div>
                      <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden border border-gray-200 dark:border-gray-800">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-700 ease-out"
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
               
               {/* Fikstür Başlığı ve Yeni Maç Butonu */}
               <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-4 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center text-lg tracking-tight">
                  <Play className="w-5 h-5 mr-2 text-blue-600" /> Karşılaşmalar
                </h3>
                <button 
                  onClick={() => setIsAddingMatch(!isAddingMatch)}
                  className="flex items-center text-sm font-black text-green-700 hover:text-green-800 bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-400 dark:hover:bg-green-900/60 px-4 py-2 rounded-xl transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Maç Ekle
                </button>
              </div>

              {/* Yeni Maç Ekleme Formu (Gizli/Açık) */}
              {isAddingMatch && (
                <div className="p-4 bg-green-50/50 dark:bg-green-900/10 border-b border-gray-100 dark:border-gray-700 flex flex-col gap-3">
                  <div className="flex gap-2">
                    <select 
                      className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-green-500 text-sm"
                      value={newMatch.homeId} onChange={(e) => setNewMatch({...newMatch, homeId: e.target.value})}
                    >
                      <option value="">Ev Sahibi Seç</option>
                      {teams.filter(t => t.groupId === activeGroupTab).map(t => <option key={`h-${t.id}`} value={t.id}>{t.name}</option>)}
                    </select>
                    <span className="font-bold text-gray-400 self-center">VS</span>
                    <select 
                      className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-green-500 text-sm"
                      value={newMatch.awayId} onChange={(e) => setNewMatch({...newMatch, awayId: e.target.value})}
                    >
                      <option value="">Deplasman Seç</option>
                      {teams.filter(t => t.groupId === activeGroupTab).map(t => <option key={`a-${t.id}`} value={t.id}>{t.name}</option>)}
                      <option value="BAY" className="font-bold text-purple-600">-- BAY GEÇ --</option>
                    </select>
                  </div>
                  <button onClick={handleAddManualMatch} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm transition-colors">
                    Haftaya Maçı Ekle
                  </button>
                </div>
              )}

              {/* Animasyonlu Maç Listesi ve Empty State (Boş Durum) */}
              <div key={`group-${activeGroupTab}-week-${activeWeekTab}`} className="p-4 space-y-4 max-h-[500px] overflow-y-auto animate-fade-in">
                {(() => {
                  const currentMatches = matches.filter(m => m.groupId === activeGroupTab && m.week === activeWeekTab);
                  
                  // EĞER O HAFTA HİÇ MAÇ YOKSA GÖRÜNECEK ŞIK EKRAN
                  if (currentMatches.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-10 text-center opacity-90">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 shadow-inner border border-gray-200 dark:border-gray-600">
                          <Calendar className="w-8 h-8 text-gray-400 dark:text-gray-400" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">Bu Hafta Planlı Maç Yok</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                          Maçlar tamamlanmış olabilir veya henüz eklenmemiş olabilir. Sağ üstteki <span className="font-bold text-green-600 dark:text-green-400">"Yeni Maç Ekle"</span> butonundan manuel maç ekleyebilirsiniz.
                        </p>
                      </div>
                    );
                  }
                  
                  // EĞER MAÇ VARSA LİSTEYİ GÖSTER
                  return currentMatches.map((match) => {
                    const homeTeam = teams.find(t => t.id === match.homeId);
                    const awayTeam = match.awayId === 'BAY' ? { name: 'BAY' } : teams.find(t => t.id === match.awayId);
                    
                    // Profesyonel Maç Durumu Hesaplayıcı
                    let statusObj = { text: '⏳ PLANLANDI', bg: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
                    
                    if (match.isBay) {
                      statusObj = { text: '⚪ BAY GEÇTİ', bg: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' };
                    } else if (match.isPlayed) {
                      statusObj = { text: '🟢 TAMAMLANDI', bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' };
                    } else if (match.homeScore !== '' || match.awayScore !== '') {
                      statusObj = { text: '🔴 CANLI', bg: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-800 animate-pulse' };
                    } else if (match.date && getMatchDayLabel(match.date) === 'BUGÜN') {
                      statusObj = { text: '🔥 BUGÜN', bg: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border border-orange-200 dark:border-orange-800' };
                    } else if (match.date && getMatchDayLabel(match.date) === 'YARIN') {
                      statusObj = { text: '📅 YAKLAŞIYOR', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800' };
                    }

                    return (
                      <div key={match.id} className={`rounded-2xl border-2 transition-all shadow-sm hover:shadow-md overflow-hidden ${match.isPlayed && !match.isBay ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/20 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'} ${match.isBay ? 'opacity-70 bg-gray-50 dark:bg-gray-900 border-dashed' : ''}`}>
                        
                        {/* KART ÜST BİLGİ (HEADER) */}
                        <div className={`flex flex-wrap md:flex-nowrap items-center justify-between border-b px-4 py-2.5 gap-2 ${match.isPlayed && !match.isBay ? 'border-emerald-100 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50'}`}>
                          
                          <div className="flex items-center flex-wrap gap-2 md:gap-3">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-md tracking-widest uppercase ${statusObj.bg}`}>
                              {statusObj.text}
                            </span>
                            
                            {!match.isBay && (
                              <div className="flex items-center gap-1.5 md:gap-2">
                                <div className="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden shadow-sm">
                                  <div className="bg-gray-100 dark:bg-gray-800 p-1.5 border-r border-gray-200 dark:border-gray-600">
                                    <Calendar className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                                  </div>
                                  <input type="date" value={match.date || ''} onChange={(e) => updateMatchDateTime(match.id, 'date', e.target.value)} className="bg-transparent text-[11px] md:text-xs font-bold text-gray-700 dark:text-gray-300 outline-none cursor-pointer px-2 w-[105px] md:w-28 focus:text-blue-600" />
                                </div>
                                <div className="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden shadow-sm">
                                  <input type="time" value={match.time || ''} onChange={(e) => updateMatchDateTime(match.id, 'time', e.target.value)} className="bg-transparent text-[11px] md:text-xs font-bold text-gray-700 dark:text-gray-300 outline-none cursor-pointer px-2 w-20 focus:text-blue-600" />
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <button onClick={() => handleDeleteMatch(match.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-lg transition-colors ml-auto md:ml-0" title="Maçı Sil">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* KART GÖVDE (TAKIMLAR VE SKOR) - YENİDEN TASARLANDI (KAYMA HATASI ÇÖZÜLDÜ) */}
                        <div className="px-2 py-6 md:px-6 md:py-8 flex items-center justify-between relative gap-2">
                          
                          {/* EV SAHİBİ */}
                          <div className="flex-1 flex items-center justify-end gap-2 md:gap-4 min-w-0">
                            <span className="font-black text-sm md:text-2xl text-gray-800 dark:text-white text-right truncate" title={homeTeam?.name}>
                              {homeTeam?.name}
                            </span>
                            <span className="w-2 h-10 md:w-3 md:h-14 rounded-full shrink-0 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                              <span className="w-full h-1/2" style={{ backgroundColor: homeTeam?.color1 || homeTeam?.color || '#ffffff' }}></span>
                              <span className="w-full h-1/2" style={{ backgroundColor: homeTeam?.color2 || '#000000' }}></span>
                            </span>
                          </div>
                          
                          {/* SKOR ALANI */}
                          <div className="shrink-0 flex items-center justify-center px-1 md:px-4">
                            {match.isBay ? (
                              <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-xl font-black text-sm tracking-widest border-2 border-gray-200 dark:border-gray-600 shadow-inner">
                                BAY
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-inner">
                                <input type="number" className="w-10 h-10 md:w-12 md:h-12 text-center font-black text-xl md:text-2xl border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none hide-arrows bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors shadow-sm" value={match.homeScore} onChange={(e) => updateScore(match.id, 'homeScore', e.target.value)} placeholder="-" />
                                <span className="text-gray-300 dark:text-gray-600 font-black text-xl px-0.5">:</span>
                                <input type="number" className="w-10 h-10 md:w-12 md:h-12 text-center font-black text-xl md:text-2xl border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none hide-arrows bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors shadow-sm" value={match.awayScore} onChange={(e) => updateScore(match.id, 'awayScore', e.target.value)} placeholder="-" />
                              </div>
                            )}
                          </div>

                          {/* DEPLASMAN */}
                          <div className="flex-1 flex items-center justify-start gap-2 md:gap-4 min-w-0">
                            {!match.isBay && (
                              <span className="w-2 h-10 md:w-3 md:h-14 rounded-full shrink-0 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                                <span className="w-full h-1/2" style={{ backgroundColor: awayTeam?.color1 || awayTeam?.color || '#ffffff' }}></span>
                                <span className="w-full h-1/2" style={{ backgroundColor: awayTeam?.color2 || '#000000' }}></span>
                              </span>
                            )}
                            <span className="font-black text-sm md:text-2xl text-gray-800 dark:text-white text-left truncate" title={awayTeam?.name}>
                              {awayTeam?.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  });
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* PLAY-OFF (ELEME) BÖLÜMÜ */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 dark:from-black dark:to-gray-800 p-6 flex flex-col md:flex-row justify-between items-center border-b-4 border-yellow-500 gap-4">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Crown className="w-7 h-7 mr-3 text-yellow-400" />
              Eleme Turları & Play-Off
            </h2>
            <div className="flex gap-3 flex-wrap justify-center">
              <button 
                onClick={() => setIsAddingPlayoff(!isAddingPlayoff)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center border border-gray-600"
              >
                <Plus className="w-4 h-4 mr-2" /> Özel Eşleşme Ekle
              </button>
              {!champion && (
                <button 
                  onClick={handleGeneratePlayoffs}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-extrabold rounded-xl shadow-lg transition-transform active:scale-95 flex items-center"
                >
                  <Play className="w-4 h-4 mr-2" /> Oto İlerle
                </button>
              )}
            </div>
          </div>

          {/* MANUEL PLAY-OFF FORMU */}
          {isAddingPlayoff && (
            <div className="p-6 bg-gray-100 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select 
                  className="p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-yellow-500 font-bold"
                  value={newPlayoff.round} onChange={(e) => setNewPlayoff({...newPlayoff, round: e.target.value})}
                >
                  <option value="Son 16">Son 16 Turu</option>
                  <option value="Çeyrek Final">Çeyrek Final</option>
                  <option value="Yarı Final">Yarı Final</option>
                  <option value="Final">Final</option>
                  <option value="3.lük Maçı">3.lük Maçı</option>
                </select>
                
                <select 
                  className="p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-yellow-500"
                  value={newPlayoff.homeId} onChange={(e) => setNewPlayoff({...newPlayoff, homeId: e.target.value})}
                >
                  <option value="">Ev Sahibi Seç</option>
                  {Array.from({ length: config.format === 'league' ? 1 : config.groupCount }).map((_, g) => 
                    standings[g].map((t, idx) => (
                      <option key={`ph-${t.id}`} value={t.id}>
                        [{config.format === 'league' ? 'Lig' : String.fromCharCode(65+g)} {idx+1}.si] {t.name}
                      </option>
                    ))
                  )}
                </select>
                
                <select 
                  className="p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-yellow-500"
                  value={newPlayoff.awayId} onChange={(e) => setNewPlayoff({...newPlayoff, awayId: e.target.value})}
                >
                  <option value="">Deplasman Seç</option>
                  {Array.from({ length: config.format === 'league' ? 1 : config.groupCount }).map((_, g) => 
                    standings[g].map((t, idx) => (
                      <option key={`pa-${t.id}`} value={t.id}>
                        [{config.format === 'league' ? 'Lig' : String.fromCharCode(65+g)} {idx+1}.si] {t.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <button onClick={handleAddManualPlayoff} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-black rounded-xl text-lg shadow-md transition-colors">
                Kura Eşleşmesini Oluştur
              </button>
            </div>
          )}
          
          <div className="p-6 bg-gray-50 dark:bg-gray-900/50 min-h-[300px]">
            {matches.filter(m => m.groupId === 'playoff').length === 0 ? (
              <div className="text-center py-16">
                <Trophy className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h4 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">Eleme Turları Henüz Başlamadı</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Grup maçları bittikten sonra sağ üstteki "Oto İlerle" veya "Özel Eşleşme Ekle" butonlarına basarak şampiyonluk yolunu çizebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-6 overflow-x-auto pb-6 custom-scrollbar snap-x">
                {Object.entries(matches.filter(m => m.groupId === 'playoff').reduce((acc, m) => {
                  if (!acc[m.round]) acc[m.round] = [];
                  acc[m.round].push(m);
                  return acc;
                }, {})).map(([roundName, roundMatches], rIdx) => {
                  const isFinal = roundName.toUpperCase().includes('FİNAL') && !roundName.toUpperCase().includes('ÇEYREK') && !roundName.toUpperCase().includes('YARI');
                  
                  return (
                  <div key={rIdx} className="flex-1 min-w-[320px] snap-center flex flex-col">
                    <div className={`text-center py-3 mb-4 rounded-xl border ${isFinal ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white border-yellow-400 shadow-md' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700'}`}>
                      <h3 className="font-black uppercase tracking-widest text-sm flex items-center justify-center">
                        {isFinal && <Trophy className="w-4 h-4 mr-2" />} {roundName}
                      </h3>
                    </div>
                    
                    <div className="flex flex-col justify-center gap-6 flex-1 relative">
                      {/* Eşleşme Bağlantı Çizgileri İçin Görsel Düzen */}
                      {roundMatches.map((match, mIdx) => {
                        const homeTeam = teams.find(t => t.id === match.homeId);
                        const awayTeam = teams.find(t => t.id === match.awayId);
                        const hScore = Number(match.homeScore);
                        const aScore = Number(match.awayScore);
                        const isHomeWinner = match.isPlayed && hScore > aScore;
                        const isAwayWinner = match.isPlayed && aScore > hScore;

                        return (
                          <div key={match.id} className={`p-4 rounded-2xl border-2 transition-all shadow-sm bg-white dark:bg-gray-800 ${isFinal ? 'border-yellow-400 dark:border-yellow-600' : 'border-gray-200 dark:border-gray-700'} relative z-10`}>
                            
                            {/* Tarih ve Sil Butonu */}
                            <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                <input type="date" value={match.date||''} onChange={e=>updateMatchDateTime(match.id, 'date', e.target.value)} className="bg-transparent outline-none cursor-pointer w-[90px]" />
                                <span className="opacity-50">•</span>
                                <input type="time" value={match.time||''} onChange={e=>updateMatchDateTime(match.id, 'time', e.target.value)} className="bg-transparent outline-none cursor-pointer w-[60px]" />
                              </div>
                              <button onClick={() => handleDeleteMatch(match.id)} className="text-red-400 hover:text-red-600 transition-colors" title="Maçı Sil">
                                 <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            {/* Takım 1 (Ev Sahibi) */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 overflow-hidden pr-2">
                                <span className="w-2 h-6 rounded-full shrink-0" style={{ backgroundColor: homeTeam?.color || '#3b82f6' }}></span>
                                <span className={`font-bold truncate text-sm ${isHomeWinner ? 'text-gray-900 dark:text-white' : match.isPlayed ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {homeTeam?.name || '???'}
                                </span>
                              </div>
                              <input type="number" className={`w-8 h-8 text-center font-black rounded-lg outline-none hide-arrows border transition-colors ${isHomeWinner ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700'}`} value={match.homeScore} onChange={e=>updateScore(match.id, 'homeScore', e.target.value)} placeholder="-" />
                            </div>

                            {/* Takım 2 (Deplasman) */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 overflow-hidden pr-2">
                                <span className="w-2 h-6 rounded-full shrink-0" style={{ backgroundColor: awayTeam?.color || '#ef4444' }}></span>
                                <span className={`font-bold truncate text-sm ${isAwayWinner ? 'text-gray-900 dark:text-white' : match.isPlayed ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {awayTeam?.name || '???'}
                                </span>
                              </div>
                              <input type="number" className={`w-8 h-8 text-center font-black rounded-lg outline-none hide-arrows border transition-colors ${isAwayWinner ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700'}`} value={match.awayScore} onChange={e=>updateScore(match.id, 'awayScore', e.target.value)} placeholder="-" />
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        </div>

        {/* --- GİZLİ PNG EXPORT TASARIMLARI (HTML2CANVAS İÇİN) --- */}
        <div className="absolute top-0 left-0 -z-50 opacity-0 pointer-events-none">
          
          {/* 1. PROFESYONEL PUAN DURUMU EXPORT KARTI */}
          <div ref={standingsExportRef} className="w-[900px] p-10 bg-gradient-to-tr from-[#064e3b] via-[#047857] to-[#065f46] border-[12px] border-[#022c22] shadow-2xl relative overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
            {/* Çim dokusu ve saha deseni */}
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <div className="absolute top-1/2 left-1/2 w-96 h-96 border-[6px] border-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col gap-6">
              {/* Header: Turnuva Adı ve Başlık */}
              <div className="text-center bg-black/80 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-inner">
                <span className="text-yellow-400 font-extrabold tracking-[0.25em] text-sm uppercase block mb-1 drop-shadow">
                  {config.tourneyName || 'HALI SAHA TURNUVASI'}
                </span>
                <h1 className="text-4xl font-black text-white tracking-wider uppercase flex justify-center items-center gap-3 drop-shadow-lg">
                  <Trophy className="w-10 h-10 text-yellow-400" />
                  {config.format === 'league' ? 'LİG PUAN DURUMU' : `${String.fromCharCode(65 + activeGroupTab)} GRUBU PUAN DURUMU`}
                </h1>
                <div className="mt-3 inline-block px-4 py-1 bg-white/10 rounded-full text-green-200 font-bold text-xs tracking-widest">
                  {new Date().toLocaleDateString('tr-TR')} • Şahin Turnuva Platformu
                </div>
              </div>

              {/* Tablo Kartı */}
              <div className="bg-black/80 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-2xl overflow-hidden">
                <table className="w-full text-white">
                  <thead>
                    <tr className="border-b-2 border-white/20 text-green-300 text-sm font-black uppercase tracking-wider">
                      <th className="py-3 px-3 text-left w-16">Sıra</th>
                      <th className="py-3 px-3 text-left">Takım Adı</th>
                      <th className="py-3 px-2 text-center w-12">O</th>
                      <th className="py-3 px-2 text-center w-12">G</th>
                      <th className="py-3 px-2 text-center w-12">B</th>
                      <th className="py-3 px-2 text-center w-12">M</th>
                      <th className="py-3 px-2 text-center w-14">AG</th>
                      <th className="py-3 px-2 text-center w-14">YG</th>
                      <th className="py-3 px-2 text-center w-14">AV</th>
                      <th className="py-3 px-3 text-center w-16 text-yellow-400">P</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-bold text-lg">
                    {standings[activeGroupTab]?.map((team, idx) => (
                      <tr key={`pro-st-${team.id}`} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-3 text-left">
                          <span className={`w-8 h-8 rounded-lg inline-flex items-center justify-center text-sm font-black ${idx === 0 ? 'bg-yellow-400 text-black shadow-lg' : idx < config.teamsPerGroupToAdvance && config.format === 'groups' ? 'bg-blue-500 text-white' : 'bg-white/10 text-white'}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-4 px-3 font-black text-xl tracking-wide truncate max-w-[220px]">{team.name}</td>
                        <td className="py-4 px-2 text-center text-gray-200">{team.played}</td>
                        <td className="py-4 px-2 text-center text-green-400">{team.won}</td>
                        <td className="py-4 px-2 text-center text-gray-300">{team.drawn}</td>
                        <td className="py-4 px-2 text-center text-red-400">{team.lost}</td>
                        <td className="py-4 px-2 text-center text-gray-200">{team.gf}</td>
                        <td className="py-4 px-2 text-center text-gray-200">{team.ga}</td>
                        <td className="py-4 px-2 text-center font-black text-emerald-300">{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                        <td className="py-4 px-3 text-center font-black text-2xl text-yellow-400 bg-white/5 rounded-lg">{team.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 2. PROFESYONEL FİKSTÜR EXPORT KARTI */}
          <div ref={fixtureExportRef} className="w-[900px] p-10 bg-gradient-to-tr from-[#064e3b] via-[#047857] to-[#065f46] border-[12px] border-[#022c22] shadow-2xl relative overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <div className="absolute top-1/2 left-1/2 w-96 h-96 border-[6px] border-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col gap-6">
              {/* Header */}
              <div className="text-center bg-black/80 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-inner">
                <span className="text-yellow-400 font-extrabold tracking-[0.25em] text-sm uppercase block mb-1 drop-shadow">
                  {config.tourneyName || 'HALI SAHA TURNUVASI'}
                </span>
                <h1 className="text-4xl font-black text-white tracking-wider uppercase flex justify-center items-center gap-3 drop-shadow-lg">
                  <Calendar className="w-10 h-10 text-yellow-400" />
                  {activeWeekTab}. HAFTA FİKSTÜRÜ
                </h1>
                <div className="mt-3 inline-block px-4 py-1 bg-white/10 rounded-full text-green-200 font-bold text-xs tracking-widest uppercase">
                  {config.format === 'groups' ? String.fromCharCode(65 + activeGroupTab) + ' GRUBU' : 'LİG ETABI'} • Turnuva
                </div>
              </div>

              {/* Maç Kartları Listesi */}
              <div className="flex flex-col gap-3">
                {matches
                  .filter(m => m.groupId === activeGroupTab && m.week === activeWeekTab)
                  .map((match) => {
                    const homeTeam = teams.find(t => t.id === match.homeId);
                    const awayTeam = match.awayId === 'BAY' ? { name: 'BAY GEÇTİ' } : teams.find(t => t.id === match.awayId);
                    
                    return (
                      <div key={`pro-fix-${match.id}`} className="flex items-center justify-between bg-black/80 px-8 py-5 rounded-2xl border border-white/10 shadow-xl relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-2 bg-yellow-400"></div>
                        
                        {/* PNG İÇİN YENİ: Tarih ve Saat Eklentisi */}
                        {(match.date || match.time) && !match.isBay && (
                          <div className="absolute top-2 left-6 text-yellow-400 text-xs font-bold tracking-widest bg-black/50 px-2 py-1 rounded-md shadow-sm flex items-center">
                            <Calendar className="w-3 h-3 mr-1.5" />
                            {match.date || "Tarih Yok"} {match.time ? `• ${match.time}` : ""}
                          </div>
                        )}
                        
                        <div className="flex-1 text-right font-black text-2xl text-white pr-6 tracking-wide truncate mt-2">
                          {homeTeam?.name || '???'}
                        </div>
                        
                        <div className="flex items-center justify-center shrink-0 w-36 bg-white/10 border border-white/10 rounded-xl py-2.5">
                           {match.isBay ? (
                              <span className="text-yellow-400 font-black text-lg tracking-widest uppercase">BAY</span>
                           ) : (
                              <div className="flex gap-3 text-3xl font-black text-white">
                                <span>{match.homeScore !== '' ? match.homeScore : '-'}</span>
                                <span className="text-white/30">:</span>
                                <span>{match.awayScore !== '' ? match.awayScore : '-'}</span>
                              </div>
                           )}
                        </div>

                        <div className="flex-1 text-left font-black text-2xl text-white pl-6 tracking-wide truncate">
                          {awayTeam?.name || '???'}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* YENİ AŞAMA 7: GENİŞLETİLMİŞ TAKIM DETAY VE KADRO MODALI */}
        {selectedTeamForRoster && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
              
              {/* Modal Başlık (Takımın Çift Rengini Alır) */}
              <div 
                className="p-5 flex justify-between items-center text-white relative overflow-hidden shrink-0 border-b border-gray-200 dark:border-gray-700" 
                style={{ background: `linear-gradient(135deg, ${selectedTeamForRoster.color1 || selectedTeamForRoster.color || '#ffffff'}, ${selectedTeamForRoster.color2 || '#000000'})` }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2"></div>
                <div className="relative z-10 flex-1 pr-4">
                  <h2 className="text-2xl font-black tracking-wide drop-shadow-md truncate">{selectedTeamForRoster.name}</h2>
                  <p className="text-white/90 text-sm font-bold uppercase tracking-widest mt-1">Takım Merkezi</p>
                </div>
                <button onClick={() => setSelectedTeamForRoster(null)} className="relative z-10 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 px-4 py-2 rounded-xl transition-colors font-bold shrink-0 shadow-sm border border-white/10">
                  Kapat
                </button>
              </div>

              <div className="overflow-y-auto flex-1 custom-scrollbar">
                
                {/* TAKIM İSTATİSTİKLERİ VE FORM ÖZETİ */}
                <div className="p-5 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                    <Award className="w-3.5 h-3.5 mr-1.5" /> Turnuva İstatistikleri
                  </h3>
                  
                  <div className="grid grid-cols-4 gap-2.5 mb-4">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700 text-center shadow-sm">
                      <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Oynanan</span>
                      <span className="block font-black text-lg text-gray-800 dark:text-white leading-none">{selectedTeamForRoster.played ?? 0}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700 text-center shadow-sm">
                      <span className="block text-[9px] font-bold text-emerald-500 uppercase tracking-wider mb-0.5">Galibiyet</span>
                      <span className="block font-black text-lg text-emerald-600 dark:text-emerald-400 leading-none">{selectedTeamForRoster.won ?? 0}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700 text-center shadow-sm">
                      <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Beraberlik</span>
                      <span className="block font-black text-lg text-gray-600 dark:text-gray-300 leading-none">{selectedTeamForRoster.drawn ?? 0}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700 text-center shadow-sm">
                      <span className="block text-[9px] font-bold text-red-500 uppercase tracking-wider mb-0.5">Mağlubiyet</span>
                      <span className="block font-black text-lg text-red-600 dark:text-red-400 leading-none">{selectedTeamForRoster.lost ?? 0}</span>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700 text-center shadow-sm">
                      <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Atılan</span>
                      <span className="block font-black text-lg text-gray-800 dark:text-white leading-none">{selectedTeamForRoster.gf ?? 0}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700 text-center shadow-sm">
                      <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Yenilen</span>
                      <span className="block font-black text-lg text-gray-800 dark:text-white leading-none">{selectedTeamForRoster.ga ?? 0}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700 text-center shadow-sm">
                      <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Averaj</span>
                      <span className="block font-black text-lg text-gray-800 dark:text-white leading-none">{(selectedTeamForRoster.gd ?? 0) > 0 ? `+${selectedTeamForRoster.gd}` : (selectedTeamForRoster.gd ?? 0)}</span>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-xl border border-green-200 dark:border-green-800/50 text-center shadow-sm">
                      <span className="block text-[9px] font-black text-green-600 dark:text-green-400 uppercase tracking-wider mb-0.5">Puan</span>
                      <span className="block font-black text-lg text-green-700 dark:text-green-400 leading-none">{selectedTeamForRoster.points ?? 0}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <span className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Son 5 Maç</span>
                    <div className="flex items-center gap-1.5">
                      {selectedTeamForRoster.form && selectedTeamForRoster.form.length > 0 ? selectedTeamForRoster.form.map((f, i) => (
                        <span key={i} className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black text-white shadow-sm ${f === 'G' ? 'bg-emerald-500' : f === 'M' ? 'bg-red-500' : 'bg-gray-400'}`}>
                          {f}
                        </span>
                      )) : (
                        <span className="text-xs text-gray-400 font-medium italic">Kayıtlı maç yok</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* OYUNCU EKLEME FORMU */}
                <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                    <Users className="w-3.5 h-3.5 mr-1.5" /> Kadro Yönetimi
                  </h3>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="No" 
                      className="w-16 p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 hide-arrows font-bold text-center"
                      value={newPlayer.number}
                      onChange={e => setNewPlayer({...newPlayer, number: e.target.value})}
                    />
                    <input 
                      type="text" 
                      placeholder="Oyuncu Adı Soyadı" 
                      className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      value={newPlayer.name}
                      onChange={e => setNewPlayer({...newPlayer, name: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
                    />
                    <button onClick={handleAddPlayer} className="px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* OYUNCU LİSTESİ */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/30">
                  {players.filter(p => p.teamId === selectedTeamForRoster.id).length === 0 ? (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="font-medium text-sm">Takıma henüz oyuncu eklenmemiş.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {players.filter(p => p.teamId === selectedTeamForRoster.id).map(player => (
                        <div key={player.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                          
                          <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                            <span className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-black text-lg rounded-xl border border-gray-200 dark:border-gray-600 shrink-0 shadow-inner">
                              {player.number || '-'}
                            </span>
                            <span className="font-bold text-gray-800 dark:text-gray-200 text-base md:text-lg truncate">{player.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            {/* OYUNCU İSTATİSTİKLERİ: Gol, Sarı Kart, Kırmızı Kart */}
                            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                              
                              {/* GOL */}
                              <div className="flex items-center">
                                <button onClick={() => handleUpdateStat(player.id, 'goals', -1)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 font-bold transition-colors">-</button>
                                <div className="text-center min-w-[20px]">
                                  <span className="block text-[10px] leading-none mb-0.5" title="Gol">⚽</span>
                                  <span className="block font-black text-gray-800 dark:text-white leading-none text-sm">{player.goals || 0}</span>
                                </div>
                                <button onClick={() => handleUpdateStat(player.id, 'goals', 1)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-green-500 font-bold transition-colors">+</button>
                              </div>

                              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-0.5"></div>
                              
                              {/* SARI KART */}
                              <div className="flex items-center">
                                <button onClick={() => handleUpdateStat(player.id, 'yellowCards', -1)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 font-bold transition-colors">-</button>
                                <div className="text-center min-w-[20px]">
                                  <span className="block text-[10px] leading-none mb-0.5" title="Sarı Kart">🟨</span>
                                  <span className="block font-black text-gray-800 dark:text-white leading-none text-sm">{player.yellowCards || 0}</span>
                                </div>
                                <button onClick={() => handleUpdateStat(player.id, 'yellowCards', 1)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-yellow-500 font-bold transition-colors">+</button>
                              </div>

                              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-0.5"></div>
                              
                              {/* KIRMIZI KART */}
                              <div className="flex items-center">
                                <button onClick={() => handleUpdateStat(player.id, 'redCards', -1)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 font-bold transition-colors">-</button>
                                <div className="text-center min-w-[20px]">
                                  <span className="block text-[10px] leading-none mb-0.5" title="Kırmızı Kart">🟥</span>
                                  <span className="block font-black text-gray-800 dark:text-white leading-none text-sm">{player.redCards || 0}</span>
                                </div>
                                <button onClick={() => handleUpdateStat(player.id, 'redCards', 1)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 font-bold transition-colors">+</button>
                              </div>

                            </div>
                            
                            <button onClick={() => handleDeletePlayer(player.id)} className="text-red-400 hover:text-red-600 p-2 ml-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl transition-colors" title="Oyuncuyu Sil">
                              <Trash2 className="w-4 h-4 md:w-4 md:h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* YENİ AŞAMA 26: ŞAMPİYON MODAL KUTUSU */}
        {champion && (
          <div id="champion-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <style>{`
              @keyframes popup { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
              .animate-popup { animation: popup 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            `}</style>
            <div className="bg-gradient-to-b from-gray-900 to-black rounded-3xl shadow-2xl p-8 md:p-12 max-w-lg w-full text-center relative overflow-hidden animate-popup border border-yellow-500/30">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#eab308_1px,transparent_1px)] [background-size:20px_20px]"></div>
              
              <div className="relative z-10">
                <Trophy className="w-32 h-32 mx-auto text-yellow-500 drop-shadow-[0_0_25px_rgba(234,179,8,0.6)] mb-6" />
                
                <h2 className="text-yellow-500 font-black tracking-[0.4em] text-sm md:text-base uppercase mb-4">
                  TURNUVA ŞAMPİYONU
                </h2>
                
                <h1 className="text-4xl md:text-5xl font-black text-white mb-8 leading-tight drop-shadow-md">
                  {champion.name}
                </h1>

                {(() => {
                  const finalMatch = matches.find(m => m.groupId === 'playoff' && m.round === 'Final' && m.isPlayed);
                  if (finalMatch) {
                    return (
                      <div className="bg-white/10 rounded-2xl p-4 mb-8 border border-white/10 backdrop-blur-sm">
                        <span className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Final Skoru</span>
                        <div className="flex items-center justify-center gap-4">
                          <span className="font-bold text-white text-lg truncate w-24 text-right">{teams.find(t=>t.id===finalMatch.homeId)?.name}</span>
                          <div className="bg-yellow-500 text-black px-4 py-1.5 rounded-lg font-black text-xl">
                            {finalMatch.homeScore} - {finalMatch.awayScore}
                          </div>
                          <span className="font-bold text-white text-lg truncate w-24 text-left">{teams.find(t=>t.id===finalMatch.awayId)?.name}</span>
                        </div>
                        {finalMatch.date && (
                          <div className="mt-3 text-gray-400 text-xs font-bold uppercase tracking-widest">
                            {formatTurkishDate(finalMatch.date)}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <button 
                  onClick={() => document.getElementById('champion-modal').style.display = 'none'}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm uppercase tracking-widest py-4 px-10 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.4)] transition-all active:scale-95"
                >
                  Kutlamayı Kapat
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  };

  return (
    <div className={`min-h-screen font-sans p-4 md:p-8 transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-slate-50 text-gray-900'}`}>
      
      {/* YENİ AŞAMA 9: PROFESYONEL SPLASH / BEKLEME EKRANI */}
      {showSplash && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-6">
           <div className="relative z-10 flex flex-col items-center text-center animate-fade-in">
             <Trophy className="w-20 h-20 text-yellow-500 mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
             
             <h2 className="text-yellow-500 font-black tracking-[0.3em] text-xs md:text-sm uppercase mb-2">
               {config.tourneyName || 'FUTBOL TURNUVASI'}
             </h2>
             
             <h1 className="text-3xl md:text-5xl font-black tracking-widest uppercase mb-4 text-white drop-shadow-md">
               TURNUVA MERKEZİ
             </h1>
             
             <div className="bg-white/5 px-6 py-2 rounded-full border border-white/10 backdrop-blur-sm mb-12">
               <span className="text-gray-400 font-bold tracking-widest text-xs uppercase">Sistem Yükleniyor</span>
             </div>
             
             <div className="flex flex-col items-center gap-3">
               <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
                 <div className="w-full h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 rounded-full animate-[pulse_1s_ease-in-out_infinite]"></div>
               </div>
               <span className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">Turnuva Hazırlanıyor...</span>
             </div>
           </div>
        </div>
      )}

      {/* Gece Modu Değiştirme Butonu */}
      <button 
        onClick={() => setIsDarkMode(!isDarkMode)} 
        className="fixed top-4 right-4 p-3 rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-yellow-400 shadow-lg border border-gray-200 dark:border-gray-700 hover:scale-110 transition-transform z-50"
        title="Gece/Gündüz Modu"
      >
        {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
      </button>

      <style>{`
        /* Sekme geçişleri için belirme animasyonu */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        
        /* Remove arrows from number inputs */
        .hide-arrows::-webkit-outer-spin-button,
        .hide-arrows::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .hide-arrows {
          -moz-appearance: textfield;
        }
      `}</style>
      
      {/* Sadece Kurulum Aşamasında Görünen Header */}
      {step < 2 && (
        <header className="max-w-7xl mx-auto mb-8 text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600 mb-2">
            {config.tourneyName || 'SahaKralı'}
          </h1>
          <p className="text-gray-500 font-medium tracking-wide">Turnuva Yönetim Sistemi</p>
        </header>
      )}

      {/* Main Content Area */}
      <main>
        {step === 0 && renderSetup()}
        {step === 1 && renderTeamsSetup()}
        {step === 2 && renderDashboard()}
      </main>
    </div>
  );
}