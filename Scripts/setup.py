from setuptools import setup, Extension
from Cython.Build import cythonize
import sysconfig

python_include_dir = sysconfig.get_path("include")

ext_modules = [
    Extension(
        "swipe_helper",
        ["swipe_helper.pyx"],
 # Add Python include directory
    )
]

setup(
    name="__Pycache__",
    extensions=cythonize(ext_modules),  # Compiling the Cython extensions
    zip_safe=False,  # If you're building Cython modules as part of the installation
)