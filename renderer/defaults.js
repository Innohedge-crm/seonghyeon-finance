/* 계정과목: 2026 수입예산(관·항·목)·지출예산(순위 1~35) 파일 기준. kinds = 총입출금 '헌금종류' 값 */
window.FIN_DEFAULTS = {
 "church": {
  "name": "대한예수교장로회 성현교회",
  "short": "성현교회",
  "address": "서울특별시 동작구 동작대로35길 14",
  "regNo": "",
  "rep": "",
  "treasurer": "",
  "clerk": ""
 },
 "offeringCols": ["주정", "감사", "십일조", "선교", "구제", "장학", "건축", "기타"],
 "accounts": [
  {
   "type": "수입",
   "gwan": "1.주일헌금",
   "mid": "11.십일조",
   "code": "111",
   "hang": "십일조헌금",
   "kinds": [
    "십일조"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "1.주일헌금",
   "mid": "12.주일",
   "code": "121",
   "hang": "주일헌금",
   "kinds": [
    "주일헌금",
    "오후예배헌금",
    "주일오후헌금"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "1.주일헌금",
   "mid": "14.주정",
   "code": "122",
   "hang": "주정헌금",
   "kinds": [
    "주정"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "1.주일헌금",
   "mid": "13.감사",
   "code": "131",
   "hang": "감사헌금",
   "kinds": [
    "감사"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "2.목적헌금",
   "mid": "21.선교",
   "code": "211",
   "hang": "선교헌금",
   "kinds": [
    "선교"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "2.목적헌금",
   "mid": "22.구제",
   "code": "221",
   "hang": "구제헌금",
   "kinds": [
    "구제"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "2.목적헌금",
   "mid": "23.장학",
   "code": "231",
   "hang": "장학헌금",
   "kinds": [
    "장학"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "2.목적헌금",
   "mid": "24.건축",
   "code": "241",
   "hang": "건축헌금",
   "kinds": [
    "건축"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "3.절기헌금",
   "mid": "31.성탄절",
   "code": "311",
   "hang": "성탄감사헌금",
   "kinds": [
    "성탄",
    "성탄감사"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "3.절기헌금",
   "mid": "32.신년",
   "code": "321",
   "hang": "신년감사헌금",
   "kinds": [
    "신년",
    "송구영신"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "3.절기헌금",
   "mid": "33.부활절",
   "code": "331",
   "hang": "부활절헌금",
   "kinds": [
    "부활"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "3.절기헌금",
   "mid": "34.맥추절",
   "code": "341",
   "hang": "맥추절헌금",
   "kinds": [
    "맥추"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "3.절기헌금",
   "mid": "35.추수감사",
   "code": "351",
   "hang": "추수감사헌금",
   "kinds": [
    "추수감사"
   ],
   "receipt": true,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "4.기타헌금",
   "mid": "4.기타헌금",
   "code": "411",
   "hang": "교회사용료(조합외)",
   "kinds": [
    "교회사용료"
   ],
   "receipt": false,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "4.기타헌금",
   "mid": "4.기타헌금",
   "code": "412",
   "hang": "3층(사택) 월세",
   "kinds": [
    "주택"
   ],
   "receipt": false,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "4.기타헌금",
   "mid": "4.기타헌금",
   "code": "413",
   "hang": "주차헌금",
   "kinds": [
    "주차"
   ],
   "receipt": false,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "4.기타헌금",
   "mid": "4.기타헌금",
   "code": "414",
   "hang": "기타(체육대회 찬조외)",
   "kinds": [
    "기타",
    "야유회 회비",
    "야유회 찬조",
    "전도부예산반환",
    "야유회비",
    "수련회 회비",
    "수련회 찬조",
    "이자"
   ],
   "receipt": false,
   "note": ""
  },
  {
   "type": "수입",
   "gwan": "이월금",
   "mid": "이월금",
   "code": "",
   "hang": "전년도이월금",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "1",
   "hang": "이장형목사님 사례비",
   "kinds": [],
   "receipt": false,
   "note": "월 150만원"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "2",
   "hang": "최태환목사님 사례비",
   "kinds": [],
   "receipt": false,
   "note": "월 120만원"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "3",
   "hang": "지휘자 사례비",
   "kinds": [],
   "receipt": false,
   "note": "월 10만원"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "4",
   "hang": "반주자 사례비",
   "kinds": [],
   "receipt": false,
   "note": "월 45만원"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "5",
   "hang": "주일학교 운영비",
   "kinds": [],
   "receipt": false,
   "note": "여름성경학교외"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "6",
   "hang": "중고등부 운영비",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "7",
   "hang": "청년부 운영비",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "8",
   "hang": "도서 구입비",
   "kinds": [],
   "receipt": false,
   "note": "목회자, 구역장, 교사 도서"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "9",
   "hang": "회의비",
   "kinds": [],
   "receipt": false,
   "note": "운영위원회 회의 운영"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "10",
   "hang": "노회비",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "11",
   "hang": "초청 강사비",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "12",
   "hang": "심방비",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "13",
   "hang": "선교비",
   "kinds": [],
   "receipt": false,
   "note": "해외 3 교회 / K 드림팀"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "14",
   "hang": "전도활동비",
   "kinds": [],
   "receipt": false,
   "note": "도시선교팀지원"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "15",
   "hang": "경조비",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "16",
   "hang": "전기요금",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "17",
   "hang": "수도요금",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "18",
   "hang": "전화요금",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "19",
   "hang": "광열비",
   "kinds": [],
   "receipt": false,
   "note": "도시가스, 석유"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "20",
   "hang": "PC통신",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "21",
   "hang": "제공과비",
   "kinds": [],
   "receipt": false,
   "note": "종합소득세"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "22",
   "hang": "행정사무비",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "23",
   "hang": "접대비",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "24",
   "hang": "비품구입비",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "25",
   "hang": "비품관리비",
   "kinds": [],
   "receipt": false,
   "note": "복사기, 정수기 렌탈외"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "26",
   "hang": "건물관리비",
   "kinds": [],
   "receipt": false,
   "note": "보수 자재비외"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "27",
   "hang": "소모품비",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "28",
   "hang": "차량 보험,세금",
   "kinds": [],
   "receipt": false,
   "note": "스타렉스 보험, 세금"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "29",
   "hang": "차량관리비",
   "kinds": [],
   "receipt": false,
   "note": "스타렉스 주유, 수리비외"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "30",
   "hang": "중식비 & 식재료비",
   "kinds": [],
   "receipt": false,
   "note": "쌀, 중식"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "31",
   "hang": "김장 및 양념",
   "kinds": [],
   "receipt": false,
   "note": "배추, 고추외"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "32",
   "hang": "선물비",
   "kinds": [],
   "receipt": false,
   "note": "어버이날외"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "33",
   "hang": "이자",
   "kinds": [],
   "receipt": false,
   "note": ""
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "34",
   "hang": "기타",
   "kinds": [],
   "receipt": false,
   "note": "체육대회, 야유회외, 퇴직금"
  },
  {
   "type": "지출",
   "gwan": "",
   "mid": "",
   "code": "35",
   "hang": "예비비",
   "kinds": [],
   "receipt": false,
   "note": ""
  }
 ]
};
