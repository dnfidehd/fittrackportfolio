import * as XLSX from 'xlsx';
import type { CompLeaderboardItem, OverallLeaderboardItem, CompetitionEvent } from '../types';

/**
 * 리더보드 데이터를 엑셀 파일로 내보내기
 * - 시트1: 종합 순위
 * - 시트2~: 종목별 리더보드
 */
export const exportLeaderboardToExcel = (
    compTitle: string,
    overallLeaderboard: OverallLeaderboardItem[],
    eventLeaderboards: { event: CompetitionEvent; leaderboard: CompLeaderboardItem[] }[]
) => {
    try {
        const wb = XLSX.utils.book_new();

        // 종합 순위 시트
        if (overallLeaderboard.length > 0) {
            const overallData = overallLeaderboard.map(item => ({
                '순위': item.rank,
                '이름': item.member_name,
                '성별': item.gender === 'M' ? '남' : item.gender === 'F' ? '여' : '',
                '소속': item.gym_name || '',
                '총점': item.total_points,
                ...Object.fromEntries(
                    Object.entries(item.event_details || {}).map(([eventName, rank]) => [eventName, `#${rank}`])
                )
            }));
            const ws = XLSX.utils.json_to_sheet(overallData);
            ws['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 6 }, { wch: 15 }, { wch: 8 }];
            XLSX.utils.book_append_sheet(wb, ws, '종합순위');
        }

        // 종목별 시트
        for (const { event, leaderboard } of eventLeaderboards) {
            if (leaderboard.length === 0) continue;
            const eventData = leaderboard.map(item => ({
                '순위': item.rank,
                '이름': item.member_name,
                '성별': item.gender === 'M' ? '남' : item.gender === 'F' ? '여' : '',
                '소속': item.gym_name || '',
                '기록': item.score_value,
                'RX/Scale': item.is_rx ? 'RX' : (item.scale_rank ? `Scale ${item.scale_rank}` : 'Scale'),
                '타임캡': item.is_time_cap ? 'Y' : '',
                '타이브레이크': item.tie_break || '',
                '비고': item.note || '',
                '상태': item.status === 'approved' ? '승인' : item.status === 'pending' ? '대기' : item.status === 'rejected' ? '반려' : ''
            }));
            const ws = XLSX.utils.json_to_sheet(eventData);
            ws['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 6 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 8 }];
            // 시트 이름은 31자 제한
            const sheetName = event.title.substring(0, 28);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        const fileName = `${compTitle}_리더보드_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
};

/**
 * 기록 입력 양식(템플릿) 엑셀 다운로드
 */
export const downloadScoreTemplate = (
    compTitle: string,
    events: CompetitionEvent[]
) => {
    try {
        const wb = XLSX.utils.book_new();

        for (const event of events) {
            const headers = [
                { '이름': '(예시) 홍길동', '성별(M/F)': 'M', '기록': '03:25', 'RX여부(Y/N)': 'Y', '스케일등급(A/B/C)': '', '타임캡(Y/N)': 'N', '타이브레이크': '', '비고': '' },
            ];
            const ws = XLSX.utils.json_to_sheet(headers);
            ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
            const sheetName = event.title.substring(0, 28);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        const fileName = `${compTitle}_기록입력양식.xlsx`;
        XLSX.writeFile(wb, fileName);
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
};

/**
 * 업로드된 엑셀 파일에서 기록 데이터 파싱
 * 반환: { sheetName: string, rows: ParsedScoreRow[] }[]
 */
export interface ParsedScoreRow {
    guest_name: string;
    guest_gender: 'M' | 'F';
    score_value: string;
    is_rx: boolean;
    scale_rank: string | null;
    is_time_cap: boolean;
    tie_break: string;
    note: string;
}

export const parseScoreExcel = (file: File): Promise<{ sheetName: string; rows: ParsedScoreRow[] }[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });

                const result = wb.SheetNames.map(sheetName => {
                    const ws = wb.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json<any>(ws);

                    const rows: ParsedScoreRow[] = jsonData
                        .filter((row: any) => row['이름'] && row['기록'])
                        .map((row: any) => ({
                            guest_name: String(row['이름'] || '').trim(),
                            guest_gender: String(row['성별(M/F)'] || 'M').toUpperCase() === 'F' ? 'F' as const : 'M' as const,
                            score_value: String(row['기록'] || '').trim(),
                            is_rx: String(row['RX여부(Y/N)'] || 'Y').toUpperCase() === 'Y',
                            scale_rank: String(row['RX여부(Y/N)'] || 'Y').toUpperCase() !== 'Y'
                                ? (String(row['스케일등급(A/B/C)'] || '').toUpperCase() || null)
                                : null,
                            is_time_cap: String(row['타임캡(Y/N)'] || 'N').toUpperCase() === 'Y',
                            tie_break: String(row['타이브레이크'] || '').trim(),
                            note: String(row['비고'] || '').trim(),
                        }));

                    return { sheetName, rows };
                });

                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('파일 읽기 실패'));
        reader.readAsArrayBuffer(file);
    });
};
