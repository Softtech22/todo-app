# Use the official Python 3.12 slim image
FROM python:3.12-slim

# Set the working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies (this will use pre-built wheels for 3.12)
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on (Render expects 10000 by default)
EXPOSE 10000

# Run the app with uvicorn (adjust "main:app" to your file/app name)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]