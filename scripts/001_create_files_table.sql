-- 파일 메타데이터를 저장할 테이블 생성
CREATE TABLE IF NOT EXISTS public.files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size BIGINT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  download_count INTEGER DEFAULT 0,
  user_id TEXT NOT NULL,
  security_mode BOOLEAN DEFAULT FALSE
);

-- RLS 활성화
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 정책 (모든 사용자가 파일 정보를 볼 수 있음 - 공유 링크용)
CREATE POLICY "files_select_all"
  ON public.files FOR SELECT
  USING (true);

-- 삽입 정책 (누구나 파일을 업로드할 수 있음)
CREATE POLICY "files_insert_all"
  ON public.files FOR INSERT
  WITH CHECK (true);

-- 업데이트 정책 (파일 소유자만 업데이트 가능)
CREATE POLICY "files_update_own"
  ON public.files FOR UPDATE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- 삭제 정책 (파일 소유자만 삭제 가능)
CREATE POLICY "files_delete_own"
  ON public.files FOR DELETE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- 글로벌 메타데이터를 저장할 테이블
CREATE TABLE IF NOT EXISTS public.global_metadata (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_visitors INTEGER DEFAULT 0,
  daily_visitors INTEGER DEFAULT 0,
  last_visitor_reset DATE DEFAULT CURRENT_DATE,
  total_downloads INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 초기 데이터 삽입
INSERT INTO public.global_metadata (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS 활성화 (읽기는 모든 사용자, 쓰기는 제한)
ALTER TABLE public.global_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metadata_select_all"
  ON public.global_metadata FOR SELECT
  USING (true);

CREATE POLICY "metadata_update_all"
  ON public.global_metadata FOR UPDATE
  USING (true);
