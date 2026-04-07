// src/constants/workouts.ts

export const WOD_TYPES = [
  { label: "For Time (시간 기록)", value: "time" },
  { label: "AMRAP (시간 내 최다 라운드)", value: "rounds" },
  { label: "EMOM (1분마다 수행)", value: "rounds" },
  { label: "Strength (중량 측정)", value: "weight" },
  { label: "Tabata (타바타)", value: "none" },
  { label: "Not for Record (기록 없음)", value: "none" }
];

export const CROSSFIT_MOVEMENTS = {
  weightlifting: [
    "Snatch (스내치)", "Clean & Jerk (용상)", "Clean (클린)", "Jerk (저크)",
    "Thruster (쓰러스터)", "Deadlift (데드리프트)", "Back Squat (백스쿼트)",
    "Front Squat (프론트스쿼트)", "Overhead Squat (오버헤드 스쿼트)", "Push Press (푸시 프레스)"
  ],
  gymnastics: [
    "Pull-up (턱걸이)", "Chest-to-Bar (C2B)", "Toes-to-Bar (T2B)", "Muscle-up (머슬업)",
    "Handstand Push-up (HSPU)", "Handstand Walk (핸드스탠드 워크)", "Burpee (버피)",
    "Box Jump (박스 점프)", "Push-up (푸시업)", "Sit-up (싯업)", "Rope Climb (로프 타기)"
  ],
  cardio: [
    "Run (달리기)", "Rowing (로잉)", "Assault Bike (어썰트 바이크)",
    "Double Under (이중뛰기)", "Ski Erg (스키)", "Wall Ball Shot (월볼샷)"
  ],
  kb_db: [
    "Kettlebell Swing (케틀벨 스윙)", "Kettlebell Snatch (케틀벨 스내치)",
    "Goblet Squat (고블렛 스쿼트)", "Turkish Get-up (터키쉬 겟업)",
    "Dumbbell Snatch (덤벨 스내치)", "Dumbbell Thruster (덤벨 쓰러스터)", "Man Maker (맨메이커)"
  ]
};

// 벤치마크 WOD 목록 (성장 추적용)
export const BENCHMARK_WODS = {
  girls: [
    { name: "Fran", description: "21-15-9 Thrusters & Pull-ups" },
    { name: "Grace", description: "30 Clean & Jerks for time" },
    { name: "Helen", description: "3 RFT: Run, KB Swings, Pull-ups" },
    { name: "Diane", description: "21-15-9 Deadlifts & HSPUs" },
    { name: "Isabel", description: "30 Snatches for time" },
    { name: "Annie", description: "50-40-30-20-10 DU & Sit-ups" },
    { name: "Karen", description: "150 Wall Balls for time" },
    { name: "Jackie", description: "Row, Thrusters, Pull-ups" },
    { name: "Nancy", description: "5 RFT: 400m Run & OHS" },
  ],
  heroes: [
    { name: "Murph", description: "Run, Pull-ups, Push-ups, Squats, Run" },
    { name: "DT", description: "5 RFT: Deadlifts, HPC, Push Jerks" },
    { name: "Randy", description: "75 Power Snatches for time" },
    { name: "Michael", description: "3 RFT: Run, Back Ext, Sit-ups" },
    { name: "Cindy", description: "AMRAP 20: Pull-ups, Push-ups, Squats" },
    { name: "Mary", description: "AMRAP 20: HSPU, Pistols, Pull-ups" },
  ]
};
