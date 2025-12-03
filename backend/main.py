from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from scipy import stats
import io
import os
import shutil
import json
from typing import List, Optional, Dict, Any
from openai import OpenAI
from pydantic import BaseModel

app = FastAPI(title="EasyDataViz API")

# CORS 설정
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 업로드 디렉토리 생성
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"message": "Welcome to EasyDataViz API"}

@app.get("/analysis-types")
def get_analysis_types():
    return [
        {
            "id": "basic_stats",
            "name": "기초 통계 분석",
            "description": "데이터의 평균, 중앙값, 표준편차 등 기본적인 통계 정보를 확인합니다.",
            "icon": "BarChart3"
        },
        {
            "id": "correlation",
            "name": "상관 분석",
            "description": "변수들 간의 상관관계를 히트맵으로 시각화하여 분석합니다.",
            "icon": "ScatterChart"
        },
        {
            "id": "distribution",
            "name": "분포 분석",
            "description": "데이터의 분포 형태를 히스토그램과 박스플롯으로 확인합니다.",
            "icon": "PieChart"
        },
        {
            "id": "regression",
            "name": "회귀 분석",
            "description": "변수 간의 인과관계를 파악하기 위한 선형 회귀 분석을 수행합니다.",
            "icon": "TrendingUp"
        }
    ]

def read_file_as_dataframe(file_path: str):
    if file_path.endswith('.csv'):
        return pd.read_csv(file_path)
    elif file_path.endswith(('.xls', '.xlsx')):
        return pd.read_excel(file_path)
    else:
        raise ValueError("Unsupported file format")

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 데이터 미리보기 생성
        df = read_file_as_dataframe(file_path)
        
        # NaN 값을 None으로 변환 (JSON 직렬화 호환성)
        df = df.where(pd.notnull(df), None)
        
        preview = df.head(10).to_dict(orient='records')
        columns = [{"name": col, "type": str(df[col].dtype)} for col in df.columns]
        
        return {
            "filename": file.filename,
            "columns": columns,
            "preview": preview,
            "total_rows": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analyze/basic/{filename}")
def get_basic_stats(filename: str):
    try:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        df = read_file_as_dataframe(file_path)
        
        # 수치형 컬럼만 선택
        numeric_df = df.select_dtypes(include=['number'])
        
        if numeric_df.empty:
            return {"message": "No numeric columns found"}
            
        stats = numeric_df.describe().to_dict()
        
        return {"stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analyze/correlation/{filename}")
def get_correlation(filename: str, cols: Optional[List[str]] = Query(None)):
    try:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        df = read_file_as_dataframe(file_path)
        numeric_df = df.select_dtypes(include=['number'])
        
        if numeric_df.empty:
            return {"message": "No numeric columns found"}
        
        # 사용자가 선택한 컬럼이 있으면 필터링
        if cols:
            # 존재하는 컬럼만 필터링
            valid_cols = [c for c in cols if c in numeric_df.columns]
            if valid_cols:
                numeric_df = numeric_df[valid_cols]
        
        # 상관계수 행렬 계산
        corr_matrix = numeric_df.corr()
        
        # NaN 값 처리 (JSON 변환 위해)
        corr_matrix = corr_matrix.where(pd.notnull(corr_matrix), None)
        
        return {
            "x": corr_matrix.columns.tolist(),
            "y": corr_matrix.columns.tolist(),
            "z": corr_matrix.values.tolist()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analyze/regression/{filename}")
def perform_regression(filename: str, x: str, y: str):
    try:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        df = read_file_as_dataframe(file_path)
        
        if x not in df.columns or y not in df.columns:
            raise HTTPException(status_code=404, detail="Columns not found")
            
        # 결측치 제거
        clean_df = df[[x, y]].dropna()
        
        if clean_df.empty:
             raise HTTPException(status_code=400, detail="Not enough data after dropping NaNs")

        x_data = clean_df[x].values
        y_data = clean_df[y].values
        
        # 선형 회귀 분석 수행
        slope, intercept, r_value, p_value, std_err = stats.linregress(x_data, y_data)
        
        # 회귀선 데이터 생성 (min, max 구간)
        line_x = [float(x_data.min()), float(x_data.max())]
        line_y = [float(slope * x_data.min() + intercept), float(slope * x_data.max() + intercept)]
        
        return {
            "slope": slope,
            "intercept": intercept,
            "r_squared": r_value**2,
            "p_value": p_value,
            "std_err": std_err,
            "scatter_data": {
                "x": x_data.tolist(),
                "y": y_data.tolist()
            },
            "line_data": {
                "x": line_x,
                "y": line_y
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analyze/column/{filename}/{column}")
def get_column_data(filename: str, column: str):
    try:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        df = read_file_as_dataframe(file_path)
        
        if column not in df.columns:
            raise HTTPException(status_code=404, detail="Column not found")
            
        # 데이터 추출 (NaN 처리)
        data = df[column].dropna().tolist()
        
        return {"column": column, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    filename: str
    query: str
    api_key: Optional[str] = None

@app.post("/analyze/chat")
async def analyze_chat(request: ChatRequest):
    file_path = os.path.join(UPLOAD_DIR, request.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        df = pd.read_csv(file_path) if request.filename.endswith('.csv') else pd.read_excel(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

    # Basic Heuristic Response (Fallback)
    if not request.api_key:
        query_lower = request.query.lower()
        if "column" in query_lower or "컬럼" in query_lower:
            return {
                "type": "text",
                "content": f"이 파일의 컬럼은 다음과 같습니다: {', '.join(df.columns)}"
            }
        elif "row" in query_lower or "행" in query_lower or "count" in query_lower:
            return {
                "type": "text",
                "content": f"총 {len(df)}개의 행이 있습니다."
            }
        elif "summary" in query_lower or "요약" in query_lower:
            return {
                "type": "text",
                "content": "데이터 요약 정보입니다.",
                "table": df.describe().to_dict()
            }
        else:
            return {
                "type": "text",
                "content": "API Key가 없어서 간단한 답변만 가능합니다. OpenAI API Key를 입력하면 더 똑똑한 분석이 가능합니다."
            }

    # OpenAI Integration
    try:
        client = OpenAI(api_key=request.api_key)
        
        # Construct Prompt
        columns_info = []
        for col in df.columns:
            dtype = str(df[col].dtype)
            sample = str(df[col].head(3).tolist())
            columns_info.append(f"- {col} ({dtype}): {sample}")
        
        columns_text = "\n".join(columns_info)
        
        system_prompt = f"""
You are a Python Data Analyst. 
You have access to a pandas DataFrame named `df` containing the full dataset.
The columns are:
{columns_text}

User Query: {request.query}

Write Python code to analyze `df` and assign the result to a dictionary named `result`.
The `result` dictionary must have a 'type' key ('text', 'plot', or 'table').

Rules:
1. If the user asks for a plot or visualization:
   - Use `plotly.express` or `plotly.graph_objects`.
   - Create a figure object `fig`.
   - Assign `result = {{'type': 'plot', 'plot_config': json.loads(fig.to_json())}}`.
   - You MUST import `json` and `plotly.express` as `px` (or `plotly.graph_objects` as `go`).
   - Use the FULL `df` data for the plot. Do not use sample data.

2. If the user asks for a text answer (e.g., count, mean, summary):
   - Calculate the answer using `df`.
   - Assign `result = {{'type': 'text', 'content': 'Your answer here'}}`.
   - The content should be a string.

3. If the user asks for a table:
   - Create a summary dataframe or list of dicts.
   - Assign `result = {{'type': 'table', 'table': df_summary.to_dict()}}`.

4. Do NOT wrap the code in markdown blocks (like ```python). Just return the raw code.
5. Ensure the code is valid and executable.
"""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
            ],
            temperature=0
        )
        
        code = response.choices[0].message.content
        
        # Clean code (remove markdown if present)
        if code.startswith("```python"):
            code = code.replace("```python", "").replace("```", "")
        elif code.startswith("```"):
            code = code.replace("```", "")
            
        print("Executing code:\n", code)
        
        # Execute Code
        import json
        import plotly
        import plotly.express as px
        
        local_scope = {
            "df": df, 
            "pd": pd, 
            "np": np, 
            "json": json, 
            "plotly": plotly, 
            "px": px
        }
        
        try:
            exec(code, {}, local_scope)
        except Exception as exec_error:
            return {
                "type": "text",
                "content": f"코드 실행 중 오류가 발생했습니다.\n\n오류 메시지: {str(exec_error)}\n\n생성된 코드:\n```python\n{code}\n```"
            }
        
        result = local_scope.get("result")
        
        if not result:
            return {
                "type": "text", 
                "content": f"코드는 실행되었으나 'result' 변수가 생성되지 않았습니다.\n\n생성된 코드:\n```python\n{code}\n```"
            }
            
        return result

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "type": "text",
            "content": f"분석 중 오류가 발생했습니다: {str(e)}"
        }
