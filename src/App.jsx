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
  
  // AÇILIŞ (SPLASH SCREEN) STATE'İ
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3500); // 3.5 saniye sonra kapanır
    return () => clearTimeout(timer);
  }, []);
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

  // YENİ EKLENEN: AKTİF SEKME STATELERİ
  const [activeGroupTab, setActiveGroupTab] = useState(0);
  const [activeWeekTab, setActiveWeekTab] = useState(1);
  const [isAddingMatch, setIsAddingMatch] = useState(false);
  const [newMatch, setNewMatch] = useState({ homeId: '', awayId: '' });
  
  // YENİ: MANUEL PLAY-OFF STATELERİ
  const [isAddingPlayoff, setIsAddingPlayoff] = useState(false);
  const [newPlayoff, setNewPlayoff] = useState({ round: 'Çeyrek Final', homeId: '', awayId: '' });

  // GÖRSEL (PNG) DIŞA AKTAR REFERANSLARI
  const standingsExportRef = useRef(null);
  const fixtureExportRef = useRef(null);

  // PUAN DURUMUNU PNG OLARAK İNDİR
  const exportStandingsToPNG = async () => {
    if (!standingsExportRef.current) return;
    try {
      const canvas = await html2canvas(standingsExportRef.current, { scale: 2, useCORS: true, backgroundColor: null });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `puan_durumu_grup_${String.fromCharCode(65 + activeGroupTab)}.png`;
      link.click();
    } catch (error) {
      console.error("Görsel oluşturulurken hata:", error);
    }
  };

  // FİKSTÜRÜ PNG OLARAK İNDİR
  const exportFixturesToPNG = async () => {
    if (!fixtureExportRef.current) return;
    try {
      const canvas = await html2canvas(fixtureExportRef.current, { scale: 2, useCORS: true, backgroundColor: null });
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

  // Calculate Standings dynamically
  // Calculate Standings dynamically (İkili Averaj Eklendi)
  const standings = useMemo(() => {
    const stats = {};
    
    // 1. İstatistikleri Sıfırla
    teams.forEach(t => {
      stats[t.id] = { ...t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
    });

    // 2. Oynanmış Maçları İşle
    matches.filter(m => m.isPlayed).forEach(m => {
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
      } else if (hScore < aScore) {
        away.won += 1; home.lost += 1; away.points += 3;
      } else {
        home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1;
      }
    });

    // 3. Genel Averajı Hesapla
    Object.values(stats).forEach(team => { team.gd = team.gf - team.ga; });

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Grup Sayısı</label>
            <input 
              type="number" min="2" max="16" 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              value={config.groupCount} 
              onChange={e => setConfig({ ...config, groupCount: parseInt(e.target.value) || 2 })}
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
              value={config.teamsPerGroup} 
              onChange={e => setConfig({ ...config, teamsPerGroup: parseInt(e.target.value) || 3 })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" title="Gruptan çıkıp Play-off'a kalacak takım sayısı">
              Gruptan Çıkan
            </label>
            <input 
              type="number" min="1" max="10" 
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none dark:bg-gray-700 dark:text-white transition-colors"
              value={config.teamsPerGroupToAdvance} 
              onChange={e => setConfig({ ...config, teamsPerGroupToAdvance: parseInt(e.target.value) || 2 })}
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
              onChange={e => setConfig({ ...config, totalWeeks: e.target.value ? parseInt(e.target.value) : '' })}
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
    
    // Takım isimlerinin dolu olup olmadığını kontrol et (Eğer boş takım varsa veya hiç takım kalmadıysa buton pasif olacak)
    const isReadyToGenerate = teams.length > 0 && teams.every(t => t.name.trim() !== '');

    return (
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 transition-colors">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
            <Users className="w-6 h-6 mr-3 text-green-600" />
            Takım Kayıtları
          </h2>
          <button onClick={() => setStep(0)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Geri Dön</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {Array.from({ length: groups }).map((_, gIndex) => (
            <div key={gIndex} className="bg-gray-50 dark:bg-gray-700 p-5 rounded-xl border border-gray-200 dark:border-gray-600 transition-colors">
              <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-4 border-b dark:border-gray-600 pb-2">
                {config.format === 'league' ? 'Lig Takımları' : `${String.fromCharCode(65 + gIndex)} Grubu`}
              </h3>
              <div className="space-y-3">
                {teams.filter(t => t.groupId === gIndex).map((team, idx) => (
                  <div key={team.id} className="flex items-center space-x-2">
                    <span className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-bold flex items-center justify-center text-sm shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      placeholder="Takım Adı"
                      className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors"
                      value={team.name}
                      onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                    />
                    <button 
                      onClick={() => handleDeleteTeam(team.id)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Takımı Sil"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={generateFixtures} 
          disabled={!isReadyToGenerate}
          className={`w-full font-bold py-4 px-4 rounded-xl flex items-center justify-center text-lg shadow-lg transition-all active:scale-95
            ${isReadyToGenerate 
              ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' 
              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
        >
          <Play className="mr-2 w-6 h-6" /> Fikstürü Oluştur ve Başla
        </button>
      </div>
    );
  };

  const renderDashboard = () => {
    const groups = config.format === 'league' ? 1 : config.groupCount;
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

        {/* Dashboard Başlık ve Butonlar */}
        <div className="flex flex-col md:flex-row items-center justify-between bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm mb-8 border border-gray-100 dark:border-gray-700 transition-colors gap-4">
          <h1 className="text-3xl font-extrabold text-gray-800 dark:text-white flex items-center tracking-tight">
            <Award className="w-8 h-8 mr-3 text-green-600 dark:text-green-400" />
            Turnuva Merkezi
          </h1>
          <div className="flex space-x-3 flex-wrap gap-y-2 justify-end">
            <button onClick={exportStandingsToPNG} className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center shadow-sm">
              <Camera className="w-4 h-4 mr-2" /> Puan Tablosu (PNG)
            </button>
            <button onClick={exportFixturesToPNG} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center shadow-sm">
              <Camera className="w-4 h-4 mr-2" /> Fikstür (PNG)
            </button>
            <button onClick={handleReset} className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 rounded-lg text-sm font-bold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shadow-sm">
              Sıfırla
            </button>
          </div>
        </div>

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
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center transition-colors">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1 text-center">Oynanan Maç</span>
                <span className="text-3xl font-black text-gray-800 dark:text-white">
                  {matches.filter(m => m.groupId === activeGroupTab && m.isPlayed && !m.isBay).length}
                </span>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center transition-colors">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1 text-center">Toplam Gol</span>
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
                  {matches.filter(m => m.groupId === activeGroupTab && m.isPlayed && !m.isBay).reduce((sum, m) => sum + Number(m.homeScore) + Number(m.awayScore), 0)}
                </span>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center transition-colors">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1 text-center">Maç Başı Gol</span>
                <span className="text-3xl font-black text-green-600 dark:text-green-400">
                  {(() => {
                    const played = matches.filter(m => m.groupId === activeGroupTab && m.isPlayed && !m.isBay);
                    const goals = played.reduce((sum, m) => sum + Number(m.homeScore) + Number(m.awayScore), 0);
                    return played.length > 0 ? (goals / played.length).toFixed(1) : '0.0';
                  })()}
                </span>
              </div>
            </div>

            {/* Tablo */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
              <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600 p-4">
                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-500" /> 
                  {config.format === 'league' ? 'Lig Puan Durumu' : `${String.fromCharCode(65 + activeGroupTab)} Grubu Puan Durumu`}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                  <thead className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 uppercase border-b border-gray-100 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3">Sıra</th>
                      <th className="px-4 py-3">Takım</th>
                      <th className="px-3 py-3 text-center">O</th>
                      <th className="px-3 py-3 text-center text-green-600 dark:text-green-400">G</th>
                      <th className="px-3 py-3 text-center text-gray-500 dark:text-gray-400">B</th>
                      <th className="px-3 py-3 text-center text-red-600 dark:text-red-400">M</th>
                      <th className="px-3 py-3 text-center">AG</th>
                      <th className="px-3 py-3 text-center">YG</th>
                      <th className="px-3 py-3 text-center font-bold">AV</th>
                      <th className="px-4 py-3 text-center font-bold text-green-700 dark:text-green-400 text-base">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings[activeGroupTab]?.map((team, idx) => (
                      <tr key={team.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' : idx < config.teamsPerGroupToAdvance && config.format === 'groups' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-200">{team.name}</td>
                        <td className="px-3 py-3 text-center">{team.played}</td>
                        <td className="px-3 py-3 text-center">{team.won}</td>
                        <td className="px-3 py-3 text-center">{team.drawn}</td>
                        <td className="px-3 py-3 text-center">{team.lost}</td>
                        <td className="px-3 py-3 text-center">{team.gf}</td>
                        <td className="px-3 py-3 text-center">{team.ga}</td>
                        <td className="px-3 py-3 text-center font-bold text-gray-600 dark:text-gray-400">{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                        <td className="px-4 py-3 text-center font-black text-green-700 dark:text-green-400 text-base bg-green-50/30 dark:bg-green-900/10">{team.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Fikstür ve Hafta Sekmeleri */}
          <div className="xl:col-span-5 flex flex-col gap-4">
            
            {/* Hafta Sekmeleri */}
            {(() => {
              const groupMatches = matches.filter(m => m.groupId === activeGroupTab && m.week);
              const maxWeek = groupMatches.length > 0 ? Math.max(...groupMatches.map(m => m.week)) : 1;
              return (
                <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700 flex overflow-x-auto gap-2 shadow-sm">
                  {Array.from({ length: maxWeek }).map((_, wIdx) => {
                    const w = wIdx + 1;
                    return (
                      <button
                        key={w}
                        onClick={() => setActiveWeekTab(w)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeWeekTab === w ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      >
                        {w}. Hafta
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
               
               {/* Fikstür Başlığı ve Yeni Maç Butonu */}
               <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600 p-4 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-500" /> {activeWeekTab}. Hafta Fikstürü
                </h3>
                <button 
                  onClick={() => setIsAddingMatch(!isAddingMatch)}
                  className="flex items-center text-sm font-bold text-green-600 hover:text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" /> Yeni Maç Ekle
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

              <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                {matches
                  .filter(m => m.groupId === activeGroupTab && m.week === activeWeekTab)
                  .map((match) => {
                    const homeTeam = teams.find(t => t.id === match.homeId);
                    const awayTeam = match.awayId === 'BAY' ? { name: 'BAY' } : teams.find(t => t.id === match.awayId);
                    
                    let statusText = '⏳ Bekliyor';
                    let statusClass = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
                    if (match.isBay) {
                      statusText = '🆓 BAY GEÇTİ';
                      statusClass = 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400';
                    } else if (match.isPlayed) {
                      statusText = '✅ Tamamlandı';
                      statusClass = 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
                    } else if (match.homeScore !== '' || match.awayScore !== '') {
                      statusText = '🔄 Canlı';
                      statusClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
                    }

                    return (
                      <div key={match.id} className={`p-4 rounded-xl border transition-colors ${match.isPlayed && !match.isBay ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'} ${match.isBay ? 'opacity-80 bg-gray-50 dark:bg-gray-900 border-dashed' : ''} shadow-sm flex flex-col gap-3`}>
                        
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2 relative">
                          <div className="flex gap-2">
                            <input type="date" value={match.date || ''} onChange={(e) => updateMatchDateTime(match.id, 'date', e.target.value)} disabled={match.isBay} className="text-xs p-1.5 border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:border-green-500 cursor-pointer disabled:opacity-50" />
                            <input type="time" value={match.time || ''} onChange={(e) => updateMatchDateTime(match.id, 'time', e.target.value)} disabled={match.isBay} className="text-xs p-1.5 border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:border-green-500 cursor-pointer disabled:opacity-50" />
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusClass}`}>
                              {statusText}
                            </span>
                            <button onClick={() => handleDeleteMatch(match.id)} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/50 p-1.5 rounded-md transition-colors" title="Maçı Sil">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex-1 text-right font-bold text-gray-800 dark:text-gray-200 pr-3 truncate">
                            {homeTeam?.name}
                          </div>
                          
                          <div className="flex items-center space-x-2 shrink-0">
                            {match.isBay ? (
                              <div className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg font-bold text-sm tracking-widest border border-gray-300 dark:border-gray-600">
                                BAY
                              </div>
                            ) : (
                              <>
                                <input type="number" className="w-12 h-10 text-center font-bold text-lg border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none hide-arrows bg-white dark:bg-gray-700 dark:text-white transition-colors" value={match.homeScore} onChange={(e) => updateScore(match.id, 'homeScore', e.target.value)} placeholder="-" />
                                <span className="text-gray-400 font-bold">:</span>
                                <input type="number" className="w-12 h-10 text-center font-bold text-lg border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none hide-arrows bg-white dark:bg-gray-700 dark:text-white transition-colors" value={match.awayScore} onChange={(e) => updateScore(match.id, 'awayScore', e.target.value)} placeholder="-" />
                              </>
                            )}
                          </div>

                          <div className="flex-1 text-left font-bold text-gray-800 dark:text-gray-200 pl-3 truncate">
                            {awayTeam?.name}
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
          
          <div className="p-6 bg-gray-50 dark:bg-gray-900/50 min-h-[200px]">
            {matches.filter(m => m.groupId === 'playoff').length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                  Grup maçları bittikten sonra sağ üstteki "Eşleşmeleri Oluştur" butonuna basarak Play-Off aşamasını başlatabilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {Object.entries(matches.filter(m => m.groupId === 'playoff').reduce((acc, m) => {
                  if (!acc[m.round]) acc[m.round] = [];
                  acc[m.round].push(m);
                  return acc;
                }, {})).map(([roundName, roundMatches], rIdx) => (
                  <div key={rIdx} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-center font-black text-gray-800 dark:text-gray-100 mb-5 pb-3 border-b-2 border-dashed border-gray-200 dark:border-gray-600 uppercase tracking-widest text-sm">
                      {roundName}
                    </h3>
                    <div className="space-y-4">
                      {roundMatches.map(match => {
                        const homeTeam = teams.find(t => t.id === match.homeId);
                        const awayTeam = teams.find(t => t.id === match.awayId);
                        return (
                          <div key={match.id} className={`p-4 rounded-xl border-2 ${match.isPlayed ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'} flex flex-col gap-3 relative overflow-hidden transition-colors`}>
                            {match.isPlayed && <div className="absolute top-0 right-0 w-8 h-8 bg-green-300 dark:bg-green-800 rounded-bl-full z-0"></div>}
                            
                            <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 relative z-10">
                              <div className="flex gap-2">
                                <input type="date" value={match.date||''} onChange={e=>updateMatchDateTime(match.id, 'date', e.target.value)} className="bg-transparent outline-none cursor-pointer" />
                                <input type="time" value={match.time||''} onChange={e=>updateMatchDateTime(match.id, 'time', e.target.value)} className="bg-transparent outline-none cursor-pointer" />
                              </div>
                              <button onClick={() => handleDeleteMatch(match.id)} className="text-red-400 hover:text-red-600 bg-white dark:bg-gray-800 rounded p-1.5 shadow-sm border border-red-100 dark:border-red-900/30 transition-colors" title="Maçı Sil">
                                 <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            <div className="flex items-center justify-between relative z-10">
                              <span className={`font-bold truncate flex-1 text-right pr-2 ${Number(match.homeScore) > Number(match.awayScore) ? 'text-green-700 dark:text-green-400 text-lg' : 'text-gray-700 dark:text-gray-300'}`}>{homeTeam?.name || '???'}</span>
                              <div className="flex space-x-1 shrink-0 bg-white dark:bg-gray-800 p-1 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                                <input type="number" className="w-10 h-10 text-center font-black text-lg focus:outline-none hide-arrows bg-transparent dark:text-white" value={match.homeScore} onChange={e=>updateScore(match.id, 'homeScore', e.target.value)} placeholder="-" />
                                <span className="font-bold text-gray-300 dark:text-gray-500 self-center">-</span>
                                <input type="number" className="w-10 h-10 text-center font-black text-lg focus:outline-none hide-arrows bg-transparent dark:text-white" value={match.awayScore} onChange={e=>updateScore(match.id, 'awayScore', e.target.value)} placeholder="-" />
                              </div>
                              <span className={`font-bold truncate flex-1 text-left pl-2 ${Number(match.awayScore) > Number(match.homeScore) ? 'text-green-700 dark:text-green-400 text-lg' : 'text-gray-700 dark:text-gray-300'}`}>{awayTeam?.name || '???'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- GİZLİ PNG EXPORT TASARIMLARI (HTML2CANVAS İÇİN) --- */}
        <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
          
          {/* 1. PROFESYONEL PUAN DURUMU EXPORT KARTI */}
          <div ref={standingsExportRef} className="w-[900px] p-10 bg-gradient-to-tr from-[#064e3b] via-[#047857] to-[#065f46] border-[12px] border-[#022c22] shadow-2xl relative overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
            {/* Çim dokusu ve saha deseni */}
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <div className="absolute top-1/2 left-1/2 w-96 h-96 border-[6px] border-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col gap-6">
              {/* Header: Turnuva Adı ve Başlık */}
              <div className="text-center bg-black/30 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-inner">
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
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-2xl overflow-hidden">
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
              <div className="text-center bg-black/30 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-inner">
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
                      <div key={`pro-fix-${match.id}`} className="flex items-center justify-between bg-black/40 backdrop-blur-md px-8 py-5 rounded-2xl border border-white/10 shadow-xl relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-2 bg-yellow-400"></div>
                        
                        <div className="flex-1 text-right font-black text-2xl text-white pr-6 tracking-wide truncate">
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

        {/* ŞAMPİYON MODAL KUTUSU */}
        {champion && (
          <div id="champion-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <style>{`
              @keyframes popup { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
              @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
              .animate-popup { animation: popup 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
              .animate-float { animation: float 3s ease-in-out infinite; }
            `}</style>
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl p-10 max-w-xl w-full text-center relative overflow-hidden animate-popup border-8 border-yellow-400">
              {/* Arka plan ışık efektleri */}
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-yellow-300 rounded-full filter blur-3xl opacity-40"></div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-yellow-500 rounded-full filter blur-3xl opacity-40"></div>
              
              <div className="animate-float mt-4">
                <Trophy className="w-40 h-40 mx-auto text-yellow-400 drop-shadow-2xl mb-6" />
              </div>
              
              <h2 className="text-lg font-black text-yellow-600 dark:text-yellow-400 tracking-[0.3em] uppercase mb-2">BÜYÜK ŞAMPİYON</h2>
              <h1 className="text-5xl md:text-6xl font-black text-gray-800 dark:text-white mb-6 leading-tight drop-shadow-sm">
                {champion.name}
              </h1>
              
              <p className="text-gray-500 dark:text-gray-300 mb-10 text-lg">
                Zorlu maçlar ve büyük mücadeleler sonucunda kupayı kaldırmayı başardı!
              </p>
              
              <button 
                onClick={() => document.getElementById('champion-modal').style.display = 'none'}
                className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-yellow-900 font-black text-lg py-4 px-10 rounded-full shadow-xl transition-all active:scale-95 border-2 border-yellow-200"
              >
                Kutlamayı Kapat
              </button>
            </div>
          </div>
        )}

      </div>
    );
  };

  return (
    <div className={`min-h-screen font-sans p-4 md:p-8 transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-slate-50 text-gray-900'}`}>
      
      {/* ŞIK YEŞİLLİ KUPA AÇILIŞ (SPLASH) EKRANI */}
      {showSplash && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-tr from-green-950 via-green-800 to-green-900 text-white p-6">
          <style>{`
            @keyframes pulseGlow {
              0%, 100% { transform: scale(1); filter: drop-shadow(0 0 15px rgba(234, 179, 8, 0.6)); }
              50% { transform: scale(1.08); filter: drop-shadow(0 0 35px rgba(234, 179, 8, 0.9)); }
            }
            .animate-glow { animation: pulseGlow 2s ease-in-out infinite; }
          `}</style>
          
          <div className="bg-black/20 backdrop-blur-xl p-10 rounded-[3rem] border border-white/10 shadow-2xl flex flex-col items-center max-w-sm w-full text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]"></div>
            
            <div className="animate-glow mb-6 relative z-10">
              <Trophy className="w-28 h-28 text-yellow-400" />
            </div>
            
            <h1 className="text-3xl font-black tracking-wider uppercase mb-2 relative z-10 text-white drop-shadow-md">
              SahaKralı
            </h1>
            <p className="text-green-200 text-sm font-bold tracking-widest uppercase mb-8 relative z-10 opacity-80">
              Şampiyonların Sahası
            </p>

            {/* Yüklenme Çubuğu */}
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden relative z-10">
              <div className="bg-yellow-400 h-full rounded-full animate-[pulse_1s_infinite]" style={{ width: '100%' }}></div>
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
      
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600 mb-2">
          SahaKralı
        </h1>
        <p className="text-gray-500 font-medium">Profesyonel Halı Saha Turnuva ve Lig Platformu</p>
      </header>

      {/* Main Content Area */}
      <main>
        {step === 0 && renderSetup()}
        {step === 1 && renderTeamsSetup()}
        {step === 2 && renderDashboard()}
      </main>
    </div>
  );
}